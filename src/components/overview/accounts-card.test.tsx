// Component test for the Overview page's Accounts card (Milestone C1).
// This is the file that fixes bug #1 Daniel reported (a wallet link missing
// `view=ledger`) and the wallet-ledger-filter-fix pass's Finding #1
// (WalletSelect silently falling back to "All wallets" for a wallet with a
// real balance but zero transactions this month). Covers: the walletHref
// regression (both row shapes), single- vs multi-wallet account rendering
// shape, negative-balance styling, and the empty-accounts state.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  walletHref,
  AccountLinkRow,
  WalletSubRow,
  AccountListItem,
  AccountsEmptyState,
} from "./accounts-card";
import type { AccountWithWallets, WalletBalance } from "@/lib/queries/wallets";

// The balance span's class list identifies it uniquely within a row.
const BALANCE_TEXT_SELECTOR = ".font-mono.text-sm.tabular-nums";

function makeWallet(overrides: Partial<WalletBalance> = {}): WalletBalance {
  return {
    id: "wlt-debit",
    name: "Debit/daily",
    color: "#4f46e5",
    sortOrder: 0,
    isSavings: false,
    includeInAvailable: true,
    balance: 100_000,
    ...overrides,
  };
}

function makeAccount(overrides: Partial<AccountWithWallets> = {}): AccountWithWallets {
  const wallets = overrides.wallets ?? [makeWallet()];
  return {
    id: "acc-bancolombia",
    name: "Bancolombia",
    accountType: "BANK",
    color: "#4f46e5",
    balance: wallets.reduce((sum, w) => sum + w.balance, 0),
    wallets,
    ...overrides,
  };
}

describe("walletHref", () => {
  it("builds a /expenses?view=ledger&walletId=<id> URL", () => {
    expect(walletHref("wlt-savings")).toBe("/expenses?view=ledger&walletId=wlt-savings");
  });

  it("URL-encodes the wallet id", () => {
    expect(walletHref("wlt with spaces")).toBe(
      "/expenses?view=ledger&walletId=wlt%20with%20spaces"
    );
  });
});

describe("AccountLinkRow — walletHref regression", () => {
  it("links by wallet id, not name — works even for a wallet with zero transactions this month", () => {
    // The exact scenario the Code Reviewer named: a wallet with a real
    // balance but no activity in the current financial month. This
    // component has no notion of "this month" at all — it only ever knows
    // the wallet id, which is the point: the ledger link must not depend on
    // monthly transaction activity.
    const account = makeAccount({ name: "Protección" });
    const wallet = makeWallet({ id: "wlt-savings-rare", name: "Ahorro programado", balance: 5_000_000 });

    render(
      <ul>
        <AccountLinkRow account={account} wallet={wallet} />
      </ul>
    );

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/expenses?view=ledger&walletId=wlt-savings-rare"
    );
  });
});

describe("WalletSubRow — walletHref regression", () => {
  it("links by wallet id, not name", () => {
    const wallet = makeWallet({ id: "wlt-investments", name: "Investments", balance: 250_000 });

    render(
      <ul>
        <WalletSubRow wallet={wallet} />
      </ul>
    );

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/expenses?view=ledger&walletId=wlt-investments"
    );
    expect(screen.getByText("Investments")).toBeInTheDocument();
  });
});

describe("AccountListItem — rendering shape", () => {
  it("single-wallet account collapses to one link row (account name as the label, no subtotal)", () => {
    const wallet = makeWallet({ id: "wlt-debit", balance: 100_000 });
    const account = makeAccount({ name: "Bancolombia", wallets: [wallet] });

    render(
      <ul>
        <AccountListItem account={account} />
      </ul>
    );

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/expenses?view=ledger&walletId=wlt-debit"
    );
    expect(screen.getByText("Bancolombia")).toBeInTheDocument();
  });

  it("multi-wallet account renders a subtotal row plus one link sub-row per wallet", () => {
    const wallets = [
      makeWallet({ id: "wlt-a", name: "Debit/daily", balance: 100_000 }),
      makeWallet({ id: "wlt-b", name: "Savings", balance: 200_000 }),
      makeWallet({ id: "wlt-c", name: "Investments", balance: 300_000 }),
    ];
    const account = makeAccount({ name: "Bancolombia", wallets });

    render(
      <ul>
        <AccountListItem account={account} />
      </ul>
    );

    // Subtotal row shows the account name (not a link) + sub-rows for each wallet.
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(screen.getByText("Bancolombia")).toBeInTheDocument();
    expect(screen.getByText("Debit/daily")).toBeInTheDocument();
    expect(screen.getByText("Savings")).toBeInTheDocument();
    expect(screen.getByText("Investments")).toBeInTheDocument();
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/expenses?view=ledger&walletId=wlt-a",
      "/expenses?view=ledger&walletId=wlt-b",
      "/expenses?view=ledger&walletId=wlt-c",
    ]);
  });
});

describe("Balance styling", () => {
  it("renders a negative wallet balance with destructive styling", () => {
    const wallet = makeWallet({ id: "wlt-overdrawn", balance: -50_000 });

    const { container } = render(
      <ul>
        <WalletSubRow wallet={wallet} />
      </ul>
    );

    const balanceText = container.querySelector(BALANCE_TEXT_SELECTOR);
    expect(balanceText).not.toBeNull();
    expect(balanceText).toHaveClass("text-destructive");
    expect(balanceText?.textContent).toContain("50.000");
  });

  it("renders a positive wallet balance without destructive styling", () => {
    const wallet = makeWallet({ id: "wlt-positive", balance: 50_000 });

    const { container } = render(
      <ul>
        <WalletSubRow wallet={wallet} />
      </ul>
    );

    const balanceText = container.querySelector(BALANCE_TEXT_SELECTOR);
    expect(balanceText).not.toBeNull();
    expect(balanceText).toHaveClass("text-foreground");
    expect(balanceText).not.toHaveClass("text-destructive");
    expect(balanceText?.textContent).toContain("50.000");
  });
});

describe("AccountsEmptyState", () => {
  it("renders the no-accounts message", () => {
    render(<AccountsEmptyState />);
    expect(screen.getByText("No accounts configured yet.")).toBeInTheDocument();
  });
});
