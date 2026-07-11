// Component test for the Ledger tab's per-row edit/delete-confirm affordance
// (ADR-035, TransactionRow). The row tap target opens a modal Dialog (shared
// `Dialog` primitive, same pattern as InstallmentForm) rather than swapping
// the row's own DOM in place. Covers: default rendering + redundant-column
// suppression, default → edit dialog → save (incl. the null-category "Sin
// categoría" clear case, the regression this test guards), default →
// delete-confirm dialog → confirm, Escape cancelling both dialog views back
// to default (via the Dialog primitive's built-in Escape handling — no more
// hand-rolled onKeyDown), and delete-confirm's Cancel button receiving focus
// by default (not Confirm — a destructive action should not default-focus
// its irreversible option).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionRow } from "./transaction-row";
import type { LedgerItem, LedgerGroupBy } from "@/lib/queries/transactions";
import type { CategoryOption } from "@/lib/queries/expenses";

const GROUP_BY_DAY: LedgerGroupBy = "day";
// The row's accessible name is now contextual (built from note/category +
// signed amount) so it disambiguates rows for screen reader users — match
// on the stable leading string rather than the full dynamic label.
const EDIT_BUTTON_NAME = /^Edit transaction/;

const updateTransactionMock = vi.fn();
const deleteTransactionMock = vi.fn();

vi.mock("@/lib/actions/transactions", () => ({
  updateTransaction: (...args: unknown[]) => updateTransactionMock(...args),
  deleteTransaction: (...args: unknown[]) => deleteTransactionMock(...args),
}));

const CATEGORIES: CategoryOption[] = [
  { id: "cat-groceries", name: "Groceries", budgetType: "VARIABLE" },
  { id: "cat-transport", name: "Transport", budgetType: "VARIABLE" },
];

function makeItem(overrides: Partial<LedgerItem> = {}): LedgerItem {
  return {
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
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TransactionRow — default mode", () => {
  it("renders note, category chip, wallet tag, and signed amount", () => {
    render(<TransactionRow item={makeItem()} groupBy={GROUP_BY_DAY} categories={CATEGORIES} />);

    expect(screen.getByText("Groceries run")).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText("· Nequi")).toBeInTheDocument();
    expect(screen.getByText(/^-/)).toBeInTheDocument();
  });

  it("hides the date column in day groupBy mode", () => {
    render(<TransactionRow item={makeItem()} groupBy={GROUP_BY_DAY} categories={CATEGORIES} />);
    expect(screen.queryByText("08 jul")).not.toBeInTheDocument();
  });

  it("shows a 'manual' tag only for a MANUAL-sourced row", () => {
    const { rerender } = render(
      <TransactionRow item={makeItem({ source: "MANUAL" })} groupBy={GROUP_BY_DAY} categories={CATEGORIES} />
    );
    expect(screen.getByText("manual")).toBeInTheDocument();

    rerender(
      <TransactionRow item={makeItem({ source: "MONEYLOVER" })} groupBy={GROUP_BY_DAY} categories={CATEGORIES} />
    );
    expect(screen.queryByText("manual")).not.toBeInTheDocument();
  });
});

describe("TransactionRow — edit mode", () => {
  it("opens the edit dialog, edits the amount, and saves with the correct payload", async () => {
    const user = userEvent.setup();
    render(<TransactionRow item={makeItem()} groupBy={GROUP_BY_DAY} categories={CATEGORIES} />);

    await user.click(screen.getByRole("button", { name: EDIT_BUTTON_NAME }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Edit transaction")).toBeInTheDocument();

    const amountInput = screen.getByLabelText("Amount");
    await user.clear(amountInput);
    await user.type(amountInput, "-60000");

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateTransactionMock).toHaveBeenCalledWith(
      "txn-1",
      expect.objectContaining({
        amount: -60000,
        appCategoryId: "cat-groceries",
        wallet: "Nequi",
        note: "Groceries run",
      })
    );
  });

  it("sends appCategoryId: null (not undefined) when 'Sin categoría' is selected — regression for the dead-clear-affordance bug", async () => {
    const user = userEvent.setup();
    render(<TransactionRow item={makeItem()} groupBy={GROUP_BY_DAY} categories={CATEGORIES} />);

    await user.click(screen.getByRole("button", { name: EDIT_BUTTON_NAME }));

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Groceries", { selector: "span" }));
    await user.click(await screen.findByRole("option", { name: "Sin categoría" }));

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateTransactionMock).toHaveBeenCalledWith(
      "txn-1",
      expect.objectContaining({ appCategoryId: null })
    );
    const payload = updateTransactionMock.mock.calls[0][1];
    expect(payload.appCategoryId).toBeNull();
    expect("appCategoryId" in payload).toBe(true);
  });

  it("Escape cancels edit mode back to the default row", async () => {
    const user = userEvent.setup();
    render(<TransactionRow item={makeItem()} groupBy={GROUP_BY_DAY} categories={CATEGORIES} />);

    await user.click(screen.getByRole("button", { name: EDIT_BUTTON_NAME }));
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByLabelText("Amount")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: EDIT_BUTTON_NAME })).toBeInTheDocument();
    expect(updateTransactionMock).not.toHaveBeenCalled();
  });

  it("sends note: null (not undefined) when the note field is cleared — regression for the dead-clear-affordance bug", async () => {
    const user = userEvent.setup();
    render(<TransactionRow item={makeItem()} groupBy={GROUP_BY_DAY} categories={CATEGORIES} />);

    await user.click(screen.getByRole("button", { name: EDIT_BUTTON_NAME }));

    const noteInput = screen.getByLabelText(/^Note/);
    await user.clear(noteInput);

    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const payload = updateTransactionMock.mock.calls[0][1];
    expect(payload.note).toBeNull();
    expect("note" in payload).toBe(true);
  });

  it("resyncs the edit draft to the latest item when opening Edit after item changed in default mode", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <TransactionRow item={makeItem()} groupBy={GROUP_BY_DAY} categories={CATEGORIES} />
    );

    rerender(
      <TransactionRow
        item={makeItem({ note: "Updated note", amount: -99_000 })}
        groupBy={GROUP_BY_DAY}
        categories={CATEGORIES}
      />
    );

    await user.click(screen.getByRole("button", { name: EDIT_BUTTON_NAME }));

    expect(screen.getByLabelText("Amount")).toHaveValue(-99000);
    expect(screen.getByLabelText(/^Note/)).toHaveValue("Updated note");
  });
});

describe("TransactionRow — delete-confirm mode", () => {
  // Delete is no longer reachable from the default row — it now lives in the
  // edit form's action bar, so reaching delete-confirm is a two-step flow:
  // tap the row to open edit mode, then click Delete inside the action bar.
  async function openDeleteConfirm(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: EDIT_BUTTON_NAME }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
  }

  it("opens delete-confirm, focuses Cancel by default, and confirming deletes", async () => {
    const user = userEvent.setup();
    render(<TransactionRow item={makeItem()} groupBy={GROUP_BY_DAY} categories={CATEGORIES} />);

    await openDeleteConfirm(user);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete transaction?")).toBeInTheDocument();
    expect(screen.getByText("Delete this transaction?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(deleteTransactionMock).toHaveBeenCalledWith("txn-1");
  });

  it("Escape cancels delete-confirm back to the default row", async () => {
    const user = userEvent.setup();
    render(<TransactionRow item={makeItem()} groupBy={GROUP_BY_DAY} categories={CATEGORIES} />);

    await openDeleteConfirm(user);
    expect(screen.getByText("Delete this transaction?")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByText("Delete this transaction?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: EDIT_BUTTON_NAME })).toBeInTheDocument();
    expect(deleteTransactionMock).not.toHaveBeenCalled();
  });
});
