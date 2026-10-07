// Bills: budget items paid once a month (ADR-052). Pure and client-safe — the
// rules for "is this bill paid this financial month" and the Pay bills form
// helpers live here so they can be tested without a DB.
//
// A bill is paid in a period when
//   (a) an expense in the period is linked to it (budgetItemId) AND still sits
//       in the bill's category — a link left behind after the row moved to
//       another category doesn't count, or
//   (b) fallback for expenses logged without a link (manual, Advisor,
//       Telegram): the bill is its category's only budget item and the
//       category has any unlinked expense in the period.
// With several items in a category an unlinked expense can't be attributed;
// it's reported in `unlinked` so the dialog can say so.

import { formatDateLabel, localISODate } from "@/lib/form-format";

export type BudgetItemForBills = {
  id: string;
  name: string;
  amount: number;
  budgetType: "FIXED" | "VARIABLE";
  isBill: boolean;
  category: { id: string; name: string; icon: string | null; color: string | null };
};

export type PeriodExpense = {
  amount: number;
  date: Date;
  appCategoryId: string | null;
  budgetItemId: string | null;
};

export type BillStatus = {
  id: string;
  name: string;
  /** Monthly budget amount. */
  budget: number;
  budgetType: "FIXED" | "VARIABLE";
  category: BudgetItemForBills["category"];
  paid: boolean;
  /** What was paid this period (0 when unpaid). */
  paidAmount: number;
  /** "YYYY-MM-DD" of the latest payment, or null. */
  paidOn: string | null;
};

/** Spend logged in a multi-bill category without a bill link. */
export type UnlinkedSpend = { categoryId: string; categoryName: string; amount: number };

type Payments = { amount: number; latest: Date | null };

function addPayment(map: Map<string, Payments>, key: string, e: PeriodExpense) {
  const prev = map.get(key) ?? { amount: 0, latest: null };
  map.set(key, {
    amount: prev.amount + Math.abs(e.amount),
    latest: prev.latest && prev.latest > e.date ? prev.latest : e.date,
  });
}

/** Linked payments per bill id, and unlinked spend per category id. */
function splitPayments(items: BudgetItemForBills[], expenses: PeriodExpense[]) {
  const billCategory = new Map(items.filter((i) => i.isBill).map((i) => [i.id, i.category.id]));
  const linked = new Map<string, Payments>();
  const unlinked = new Map<string, Payments>();
  for (const e of expenses) {
    if (e.amount >= 0 || !e.appCategoryId) continue;
    const validLink = e.budgetItemId !== null && billCategory.get(e.budgetItemId) === e.appCategoryId;
    if (validLink) addPayment(linked, e.budgetItemId as string, e);
    else addPayment(unlinked, e.appCategoryId, e);
  }
  return { linked, unlinked };
}

function byUnpaidThenAmount(a: BillStatus, b: BillStatus): number {
  if (a.paid !== b.paid) return a.paid ? 1 : -1;
  return b.budget - a.budget || a.name.localeCompare(b.name);
}

/** Every bill with its paid status for the period, unpaid first (biggest first). */
export function billStatuses(
  items: BudgetItemForBills[],
  expenses: PeriodExpense[],
): { bills: BillStatus[]; unlinked: UnlinkedSpend[] } {
  const { linked, unlinked } = splitPayments(items, expenses);
  const itemsPerCategory = new Map<string, BudgetItemForBills[]>();
  for (const i of items) itemsPerCategory.set(i.category.id, [...(itemsPerCategory.get(i.category.id) ?? []), i]);

  const bills = items
    .filter((i) => i.isBill)
    .map((i): BillStatus => {
      const soleItem = itemsPerCategory.get(i.category.id)?.length === 1;
      const payment = linked.get(i.id) ?? (soleItem ? unlinked.get(i.category.id) : undefined);
      return {
        id: i.id,
        name: i.name,
        budget: i.amount,
        budgetType: i.budgetType,
        category: i.category,
        paid: !!payment,
        paidAmount: payment?.amount ?? 0,
        paidOn: payment?.latest ? localISODate(payment.latest) : null,
      };
    })
    .sort(byUnpaidThenAmount);

  // Worth mentioning only where the spend could be one of the unpaid bills:
  // several items, all of them bills, at least one unpaid.
  const unlinkedSpend: UnlinkedSpend[] = [];
  for (const [categoryId, catItems] of itemsPerCategory) {
    const spend = unlinked.get(categoryId);
    if (!spend || catItems.length < 2 || !catItems.every((i) => i.isBill)) continue;
    if (!bills.some((b) => b.category.id === categoryId && !b.paid)) continue;
    unlinkedSpend.push({ categoryId, categoryName: catItems[0].category.name, amount: spend.amount });
  }
  return { bills, unlinked: unlinkedSpend };
}

/** Bills not paid yet, as the Home / Analysis insight lists them. */
export function unpaidBills(bills: BillStatus[]): { name: string; amount: number }[] {
  return bills.filter((b) => !b.paid).map((b) => ({ name: b.name, amount: b.budget }));
}

/** New budget items: fixed ones are bills unless the user says otherwise. */
export function billDefaultForType(budgetType: "FIXED" | "VARIABLE"): boolean {
  return budgetType === "FIXED";
}

/** Entered amount minus the budget, or null while the field is empty. */
export function billDifference(amountDigits: string, budget: number): number | null {
  if (amountDigits === "") return null;
  const amount = Number(amountDigits);
  return Number.isFinite(amount) ? amount - budget : null;
}

/** `iso` inside the half-open period [startISO, endISO) — all "YYYY-MM-DD". */
export function isDateInPeriod(iso: string, startISO: string, endISO: string): boolean {
  return iso >= startISO && iso < endISO;
}

export type PayBillsRow = { name: string; checked: boolean; amount: string };

/** Footer hint for Pay bills; empty when it can be submitted. */
export function payBillsMissingHint(rows: PayBillsRow[], walletId: string | null, date: string): string {
  const selected = rows.filter((r) => r.checked);
  if (selected.length === 0) return "Tick at least one bill.";
  const noAmount = selected.find((r) => !(Number(r.amount) > 0));
  if (noAmount) return `Add an amount for ${noAmount.name}.`;
  if (!walletId) return "Pick a wallet.";
  if (date === "") return "Pick a date.";
  return "";
}

/** "Paid today" / "Paid yesterday" / "Paid Oct 1" — "Paid" when the date is unknown. */
export function paidChipLabel(paidOn: string | null, now: Date = new Date()): string {
  if (!paidOn) return "Paid";
  const label = formatDateLabel(paidOn, now);
  if (label.startsWith("Today")) return "Paid today";
  if (label.startsWith("Yesterday")) return "Paid yesterday";
  return `Paid ${label}`;
}
