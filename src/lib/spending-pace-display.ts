// Display rules for Trends › Pace: this financial period so far against the
// same days of the previous one. Pure and client-safe; the numbers come from
// comparePeriodToDate (the Advisor's compare_period_to_date tool).

import type { CategorizedFlow, CategoryDelta, WalletChange } from "@/lib/period-comparison-utils";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Calendar-day index via UTC dates, so a DST shift can't skew it.
function dayIndex(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
}

/** Days in [start, end): a financial period's length. */
export function periodLength(start: Date, end: Date): number {
  return dayIndex(end) - dayIndex(start);
}

/**
 * Spending accumulated by the end of each day: index 0 = day 1. Transfers
 * and income never count, matching summarizeWindow.
 */
export function cumulativeSpendByDay(flows: CategorizedFlow[], start: Date, days: number): number[] {
  const perDay = new Array<number>(days).fill(0);
  const first = dayIndex(start);
  for (const f of flows) {
    if (f.isTransfer || f.amount >= 0) continue;
    const i = dayIndex(f.date) - first;
    if (i >= 0 && i < days) perDay[i] -= f.amount;
  }
  let sum = 0;
  return perDay.map((v) => Math.round((sum += v)));
}

export type PacePoint = {
  day: number;
  current: number | null;
  /** Last period up to today's day: drawn solid. */
  previousSoFar: number | null;
  /** Last period from today's day on: drawn dashed. */
  previousRest: number | null;
};

/** Chart rows: one per day of the longer period; the two last-period series share today's point. */
export function pacePoints(current: number[], previous: number[], today: number): PacePoint[] {
  const days = Math.max(previous.length, today);
  return Array.from({ length: days }, (_, i) => {
    const day = i + 1;
    const prev = previous[i] ?? null;
    return {
      day,
      current: day <= today ? (current[i] ?? null) : null,
      previousSoFar: day <= today ? prev : null,
      previousRest: day >= today ? prev : null,
    };
  });
}

/** Percent change against last period; null when last period had nothing to compare with. */
export function pacePercent(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

export function paceLabel(delta: number): string {
  if (delta > 0) return "More than last period";
  if (delta < 0) return "Less than last period";
  return "Same as last period";
}

/** "Oct 25 – Nov 3" for a window whose `until` is exclusive. */
export function formatWindowRange(from: Date, until: Date): string {
  const last = new Date(until.getFullYear(), until.getMonth(), until.getDate() - 1);
  const label = (d: Date) => `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  return last <= from ? label(from) : `${label(from)} – ${label(last)}`;
}

export type PaceCategoryRow = {
  category: string;
  current: number;
  previous: number;
  delta: number;
  /** Nothing in this category on the same days last period. */
  isNew: boolean;
  /** An unpaid bill of this category explains (part of) the drop. */
  notPaidYet: boolean;
};

export type CategoryChanges = {
  more: PaceCategoryRow[];
  less: PaceCategoryRow[];
  moreTotal: number;
  lessTotal: number;
  unchanged: number;
};

/**
 * Splits the category deltas into "spending more" and "spending less", each
 * largest difference first. Categories with spend in
 * either window and no difference count as unchanged; ones seen only in the
 * baseline are left out.
 */
export function splitCategoryChanges(categories: CategoryDelta[], unpaidBillCategories: string[] = []): CategoryChanges {
  const unpaid = new Set(unpaidBillCategories);
  const changed = categories.filter((c) => Math.abs(c.delta) >= 1);
  const toRow = (c: CategoryDelta): PaceCategoryRow => ({
    category: c.category,
    current: c.current,
    previous: c.previous,
    delta: c.delta,
    isNew: c.previous === 0,
    notPaidYet: c.delta < 0 && unpaid.has(c.category),
  });
  const bySize = (a: PaceCategoryRow, b: PaceCategoryRow) =>
    Math.abs(b.delta) - Math.abs(a.delta) || a.category.localeCompare(b.category);
  const more = changed.filter((c) => c.delta > 0).map(toRow).sort(bySize);
  const less = changed.filter((c) => c.delta < 0).map(toRow).sort(bySize);
  const sum = (rows: PaceCategoryRow[]) => rows.reduce((s, r) => s + r.delta, 0);
  return {
    more,
    less,
    moreTotal: sum(more),
    lessTotal: sum(less),
    unchanged: categories.filter((c) => Math.abs(c.delta) < 1 && (c.current > 0 || c.previous > 0)).length,
  };
}

export type BalanceReason = { label: string; value: number };

/**
 * Why the wallet's balance differs from the same day last period, each cause
 * signed by its effect on the balance. Zero causes are dropped; the values
 * add up to endBalanceDelta (decomposeWalletChange is exact).
 */
export function walletChangeReasons(change: WalletChange): BalanceReason[] {
  const reasons: BalanceReason[] = [
    { label: change.carryover >= 0 ? "Started higher" : "Started lower", value: change.carryover },
    { label: change.incomeDelta >= 0 ? "More income" : "Less income", value: change.incomeDelta },
    { label: change.spendDelta >= 0 ? "Spent more" : "Spent less", value: -change.spendDelta },
    { label: "Transfers", value: change.transfersDelta },
    { label: "Loans, vaults and adjustments", value: change.otherFlowsDelta },
  ];
  return reasons.filter((r) => Math.abs(r.value) >= 1);
}
