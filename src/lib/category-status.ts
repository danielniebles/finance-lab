// How a category row reads in the Expenses analysis: a short status label +
// tone, and how rows are grouped/filtered. Pure and client-safe.

import type { CategoryBudgetType, CategorySeverity } from "@/lib/queries/expenses";
import { toneForBudgetUsed, toneForCategorySeverity, type Tone } from "@/lib/status";

export type CategoryStatusRow = {
  id: string;
  name: string;
  budgetType: CategoryBudgetType;
  spent: number;
  budget: number;
  control: number;
  percentUsed: number | null;
  note: string | null;
  severity: CategorySeverity;
};

export function categoryStatus(row: CategoryStatusRow): { label: string; tone: Tone } {
  switch (row.severity) {
    case "Pending":
      return { label: "Pending", tone: "info" };
    case "Unplanned":
      return { label: "No budget", tone: "unplanned" };
    case "Critical":
      return { label: "Over budget", tone: "danger" };
    case "Issue":
      if (row.note === "Unpaid") return { label: "Unpaid", tone: "caution" };
      return { label: row.budgetType === "FIXED" ? "Paid · more" : "Over budget", tone: "caution" };
    case "OK":
      if (row.budgetType === "FIXED") {
        return { label: row.note === "Lower than expected" ? "Paid · less" : "Paid", tone: "positive" };
      }
      return { label: "On track", tone: toneForCategorySeverity("OK") };
  }
}

/** Fill tone for a row's meter. */
export function meterTone(row: CategoryStatusRow): Tone {
  if (row.severity === "Unplanned") return "unplanned";
  if (row.budgetType === "FIXED") return row.spent > row.budget ? "caution" : "positive";
  return toneForBudgetUsed(row.percentUsed ?? 0);
}

/** No budget and nothing spent — noise in the table, hidden by default. */
export function isEmptyCategory(row: Pick<CategoryStatusRow, "budget" | "spent">): boolean {
  return row.budget === 0 && row.spent === 0;
}

/** Split into Fixed / Variable (Mixed goes with Variable), biggest spend first. */
export function groupCategories<T extends CategoryStatusRow>(rows: T[]): { fixed: T[]; variable: T[] } {
  const bySpend = (a: T, b: T) => b.spent - a.spent || b.budget - a.budget;
  return {
    fixed: rows.filter((r) => r.budgetType === "FIXED").sort(bySpend),
    variable: rows.filter((r) => r.budgetType !== "FIXED").sort(bySpend),
  };
}
