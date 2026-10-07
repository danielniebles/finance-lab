// Turns the month's analysis + forecast into the short "Insights" list on the
// Home page. Pure and client-safe so it can be unit-tested without a DB.
//
// Rules, in priority order (max 3 cards):
//   1. Categories with spend and no budget ("Unplanned") — biggest first.
//   2. Categories over budget (Critical / Issue "Higher than expected").
//   3. Bills not paid yet (ADR-052) — informational, never an issue: bills
//      get paid during the month, so $0 on day 10 is expected. It opens Pay
//      bills, so it always keeps its slot; 1 and 2 fill the rest.
// The forecast is shown separately (see ForecastInsight) because it is a
// projection, not a fact about this month's spending.

import type { CategorySeverity } from "@/lib/queries/expenses";
import type { Tone } from "@/lib/status";

export type InsightCategory = {
  id: string;
  name: string;
  spent: number;
  budget: number;
  percentUsed: number | null;
  severity: CategorySeverity;
  note: string | null;
  budgetType: "FIXED" | "VARIABLE" | "MIXED";
};

export type HomeInsight = {
  key: string;
  tone: Tone;
  title: string;
  detail: string;
  amount: number;
  /** Category name to filter the ledger by, when the insight is about one category. */
  category?: string;
  /** The card opens the Pay bills dialog. */
  action?: "pay-bills";
};

/** A bill not paid yet this period, with its budget amount (lib/bill-display unpaidBills). */
export type UnpaidBill = { name: string; amount: number };

export const MAX_INSIGHTS = 3;

/** A fixed bill not paid yet while the month is running — pending, not a problem. */
export function isPendingFixed(c: InsightCategory): boolean {
  return c.severity === "Pending";
}

function unplannedInsights(categories: InsightCategory[]): HomeInsight[] {
  return categories
    .filter((c) => c.severity === "Unplanned" && c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .map((c) => ({
      key: `unplanned-${c.id}`,
      tone: "unplanned" as const,
      title: `${c.name} has no budget`,
      detail: "Spending here isn't planned for. Set a budget to track it.",
      amount: c.spent,
      category: c.name,
    }));
}

function overBudgetInsights(categories: InsightCategory[]): HomeInsight[] {
  return categories
    .filter((c) => (c.severity === "Critical" || c.severity === "Issue") && !isPendingFixed(c))
    .filter((c) => c.spent > c.budget)
    .sort((a, b) => b.spent - b.budget - (a.spent - a.budget))
    .map((c) => ({
      key: `over-${c.id}`,
      tone: c.severity === "Critical" ? ("danger" as const) : ("caution" as const),
      title: `${c.name} is over budget`,
      detail:
        c.percentUsed !== null
          ? `${Math.round(c.percentUsed)}% of its budget used.`
          : "Spent more than planned.",
      amount: c.spent - c.budget,
      category: c.name,
    }));
}

function pendingBillsInsight(bills: UnpaidBill[]): HomeInsight[] {
  if (bills.length === 0) return [];
  return [
    {
      key: "pending-bills",
      tone: "info",
      title: `${bills.length} ${bills.length === 1 ? "bill" : "bills"} not paid yet`,
      detail: bills.map((b) => b.name).join(", "),
      amount: bills.reduce((s, b) => s + b.amount, 0),
      action: "pay-bills",
    },
  ];
}

export function buildHomeInsights(categories: InsightCategory[], unpaidBills: UnpaidBill[] = []): HomeInsight[] {
  const bills = pendingBillsInsight(unpaidBills);
  const others = [...unplannedInsights(categories), ...overBudgetInsights(categories)];
  return [...others.slice(0, MAX_INSIGHTS - bills.length), ...bills];
}
