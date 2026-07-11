// Component test for TransactionGroupList's redundant-column-suppression
// rendering (ADR-035, design spec's "Redundant-column suppression" decision):
// the dimension currently being grouped by is redundant on every row within
// that group and must be hidden — date in day mode, the category chip in
// category mode, the wallet tag in wallet mode — while the other two
// dimensions stay visible.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionGroupList } from "./transaction-group-list";
import type { LedgerGroup } from "@/lib/queries/transactions";
import type { CategoryOption } from "@/lib/queries/expenses";

vi.mock("@/lib/actions/transactions", () => ({
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}));

const CATEGORIES: CategoryOption[] = [{ id: "cat-groceries", name: "Groceries", budgetType: "VARIABLE" }];

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
        note: "Groceries run",
        categoryName: "Groceries",
        categoryIcon: null,
        categoryColor: null,
        source: "MONEYLOVER",
      },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

function dateColumnPresent(container: HTMLElement): boolean {
  return container.querySelector(".w-11") !== null;
}

describe("TransactionGroupList — redundant-column suppression", () => {
  it("day mode: hides the date column, shows the category chip and wallet tag", () => {
    const { container } = render(
      <TransactionGroupList groups={GROUPS} groupBy="day" categories={CATEGORIES} />
    );

    expect(dateColumnPresent(container)).toBe(false);
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("· Nequi")).toBeInTheDocument();
  });

  it("category mode: shows the date column, hides the category chip, shows the wallet tag", () => {
    const { container } = render(
      <TransactionGroupList groups={GROUPS} groupBy="category" categories={CATEGORIES} />
    );

    expect(dateColumnPresent(container)).toBe(true);
    expect(screen.queryByText("Groceries", { selector: "span.rounded-full" })).not.toBeInTheDocument();
    expect(screen.getByText("· Nequi")).toBeInTheDocument();
  });

  it("wallet mode: shows the date column, shows the category chip, hides the wallet tag", () => {
    const { container } = render(
      <TransactionGroupList groups={GROUPS} groupBy="wallet" categories={CATEGORIES} />
    );

    expect(dateColumnPresent(container)).toBe(true);
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.queryByText("· Nequi")).not.toBeInTheDocument();
  });

  it("renders the group header label and a negative, sign-colored subtotal", () => {
    const { container } = render(
      <TransactionGroupList groups={GROUPS} groupBy="day" categories={CATEGORIES} />
    );

    expect(screen.getByText("Mié 8 jul")).toBeInTheDocument();
    const header = container.querySelector(".bg-muted");
    const subtotal = header?.querySelector(".font-mono");
    expect(subtotal?.textContent).toMatch(/^-\$\s?50[.,]000$/);
    expect(subtotal).toHaveClass("text-destructive");
  });
});
