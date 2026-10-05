// Covers the Home page's pure helpers and the wallet tile — including the
// walletHref regression the old accounts-card test guarded (a wallet link
// missing `view=ledger`).
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AccountWithWallets, WalletBalance } from "@/lib/queries/wallets";
import { allocationSlices, liquidityTone } from "./balance-card";
import { WalletCard, walletHref, walletTiles } from "./wallets-strip";
import { topSpending } from "./spending-panel";

function wallet(o: Partial<WalletBalance> = {}): WalletBalance {
  return { id: "w1", name: "Debit/daily", color: null, sortOrder: 0, isSavings: false, includeInAvailable: true, balance: 100, ...o };
}

function account(o: Partial<AccountWithWallets> = {}): AccountWithWallets {
  const wallets = o.wallets ?? [wallet()];
  return {
    id: "a1",
    name: "Bancolombia",
    accountType: "BANK",
    color: "#eab308",
    includeInOverviewTotal: true,
    balance: wallets.reduce((s, w) => s + w.balance, 0),
    wallets,
    ...o,
  } as AccountWithWallets;
}

describe("walletHref", () => {
  it("opens the ledger filtered by wallet", () => {
    expect(walletHref("w 1")).toBe("/expenses?view=ledger&walletId=w%201");
  });
});

describe("walletTiles", () => {
  it("puts accounts left out of the total last", () => {
    const tiles = walletTiles([
      account({ id: "hidden", name: "Protección", includeInOverviewTotal: false, wallets: [wallet({ id: "p" })] }),
      account({ id: "bank", wallets: [wallet({ id: "d" }), wallet({ id: "s", name: "savings" })] }),
    ]);
    expect(tiles.map((t) => t.wallet.id)).toEqual(["d", "s", "p"]);
    expect(tiles[2].hidden).toBe(true);
  });
});

describe("WalletCard", () => {
  it("links to the wallet's ledger and marks hidden accounts", () => {
    const acc = account({ name: "Rappi", includeInOverviewTotal: false, wallets: [wallet({ id: "r", balance: 200_000 })] });
    render(<WalletCard tile={{ wallet: acc.wallets[0], account: acc, hidden: true }} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", walletHref("r"));
    expect(screen.getByText("Not in total")).toBeInTheDocument();
  });
});

describe("allocationSlices", () => {
  it("uses included accounts, positive balances, biggest first", () => {
    const slices = allocationSlices([
      account({ wallets: [wallet({ id: "a", balance: 10 }), wallet({ id: "b", name: "inv", balance: 30 }), wallet({ id: "c", balance: -5 })] }),
      account({ id: "x", includeInOverviewTotal: false, wallets: [wallet({ id: "z", balance: 999 })] }),
    ]);
    expect(slices.map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("liquidityTone", () => {
  it("matches the old pill thresholds", () => {
    expect(liquidityTone(3.8).tone).toBe("danger");
    expect(liquidityTone(40).tone).toBe("caution");
    expect(liquidityTone(70).tone).toBe("positive");
  });
});

describe("topSpending", () => {
  it("drops zero rows and keeps the six biggest", () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`, name: `C${i}`, icon: null, color: null, spent: i * 10, budget: 0, percentUsed: null, severity: "OK" as const,
    }));
    const top = topSpending(rows);
    expect(top).toHaveLength(6);
    expect(top[0].id).toBe("c7");
    expect(top.some((r) => r.spent === 0)).toBe(false);
  });
});
