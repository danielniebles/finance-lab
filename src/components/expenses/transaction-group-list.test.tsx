// Component test for TransactionGroupList's redundant-column-suppression
// rendering (ADR-035, design spec's "Redundant-column suppression" decision):
// the dimension currently being grouped by is redundant on every row within
// that group and must be hidden — date in day mode, the category chip in
// category mode — while the other dimension stays visible. The per-row
// wallet tag was removed entirely (no longer rendered in any groupBy mode).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionGroupList } from "./transaction-group-list";
import type { LedgerGroup } from "@/lib/queries/transactions";
import type { CategoryOption } from "@/lib/queries/expenses";

vi.mock("@/lib/actions/transactions", () => ({
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  setTransactionTags: vi.fn(),
}));

const CATEGORIES: CategoryOption[] = [
  { id: "cat-groceries", name: "Groceries", budgetType: "VARIABLE", isTransfer: false },
];

const GROUPS: LedgerGroup[] = [
  {
    key: "2026-07-08",
    label: "Mié 8 jul",
    subtotal: -50_000,
    items: [
      {
        id: "txn-1",
        date: new Date(2026, 6, 8),
        amount: -50_000,
        wallet: "Nequi",
        walletId: null,
        walletName: null,
        walletColor: null,
        note: "Groceries run",
        categoryName: "Groceries",
        categoryIcon: null,
        categoryColor: null,
        source: "MONEYLOVER",
        tags: [],
        isTransfer: false,
      },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

function dateColumnPresent(container: HTMLElement): boolean {
  // The date column is the fixed-width w-14 span rendered only outside day mode.
  return container.querySelector(".w-14") !== null;
}

describe("TransactionGroupList — redundant-column suppression", () => {
  it("day mode: hides the date column, shows the category chip", () => {
    const { container } = render(
      <TransactionGroupList groups={GROUPS} groupBy="day" categories={CATEGORIES} walletOptions={[]} tags={[]} />
    );

    expect(dateColumnPresent(container)).toBe(false);
    expect(screen.getByText("Groceries")).toBeInTheDocument();
  });

  it("category mode: shows the date column, hides the category chip", () => {
    const { container } = render(
      <TransactionGroupList groups={GROUPS} groupBy="category" categories={CATEGORIES} walletOptions={[]} tags={[]} />
    );

    expect(dateColumnPresent(container)).toBe(true);
    expect(screen.queryByText("Groceries", { selector: "span.rounded-full" })).not.toBeInTheDocument();
  });

  it("wallet mode: shows the date column, shows the category chip", () => {
    const { container } = render(
      <TransactionGroupList groups={GROUPS} groupBy="wallet" categories={CATEGORIES} walletOptions={[]} tags={[]} />
    );

    expect(dateColumnPresent(container)).toBe(true);
    expect(screen.getByText("Groceries")).toBeInTheDocument();
  });

  it("renders the group header label and a signed subtotal in neutral text", () => {
    const { container } = render(
      <TransactionGroupList groups={GROUPS} groupBy="day" categories={CATEGORIES} walletOptions={[]} tags={[]} />
    );

    expect(screen.getByText("Mié 8 jul")).toBeInTheDocument();
    const header = container.querySelector(".bg-muted");
    const subtotal = header?.querySelector(".font-mono");
    expect(subtotal?.textContent).toMatch(/^-\$\s?50[.,]000$/);
    expect(subtotal).toHaveClass("text-foreground");
    expect(subtotal).not.toHaveClass("text-destructive");
  });
});

describe("TransactionGroupList — wallet tag", () => {
  const WITH_WALLET: LedgerGroup[] = [
    { ...GROUPS[0], items: [{ ...GROUPS[0].items[0], walletId: "wlt_daily", walletName: "Daily", walletColor: null }] },
  ];

  it("shows each row's wallet under All wallets", () => {
    render(<TransactionGroupList groups={WITH_WALLET} showWallet categories={CATEGORIES} walletOptions={[]} tags={[]} />);
    expect(screen.getByText("Daily")).toBeInTheDocument();
  });

  it("hides it when a wallet is selected", () => {
    render(<TransactionGroupList groups={WITH_WALLET} categories={CATEGORIES} walletOptions={[]} tags={[]} />);
    expect(screen.queryByText("Daily")).not.toBeInTheDocument();
  });
});
