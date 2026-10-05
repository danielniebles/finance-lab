// Pure helpers for the Trends page and its queries — client-safe, no DB.

import { financialMonthYear } from "@/lib/financial-period-utils";

export type MonthKey = { month: number; year: number };
export type TrendSlot = MonthKey & { inProgress: boolean };

/** (month, year) moved by `delta` months; month is 1-based. */
export function shiftMonth({ month, year }: MonthKey, delta: number): MonthKey {
  const index = year * 12 + (month - 1) + delta;
  return { month: (index % 12) + 1, year: Math.floor(index / 12) };
}

/**
 * The months a trend covers, oldest → newest: the `n` most recent COMPLETE
 * financial months, plus — when `includeCurrent` — the month in progress,
 * flagged so callers can draw it as a draft and keep it out of averages.
 *
 * Calendar based on purpose: trends used to pick months from FINAL
 * ImportBatches, which dropped July (a partial import left it IN_PROGRESS)
 * and froze once imports stopped. Transactions are logged directly now, so
 * every past month is complete by definition.
 */
export function trendWindow(now: Date, n: number, startDay: number, includeCurrent = false): TrendSlot[] {
  const current = financialMonthYear(now, startDay);
  const slots: TrendSlot[] = [];
  for (let back = n; back >= 1; back--) slots.push({ ...shiftMonth(current, -back), inProgress: false });
  if (includeCurrent) slots.push({ ...current, inProgress: true });
  return slots;
}

/**
 * Drops leading slots with no data so a short history doesn't open with a
 * run of empty months. Interior gaps stay (a $0 month is real information).
 */
export function trimLeadingEmpty<T>(items: T[], hasData: (item: T) => boolean): T[] {
  const first = items.findIndex(hasData);
  return first === -1 ? [] : items.slice(first);
}

/** Average of the complete months only (in-progress and empty slots skipped). */
export function completeAverage(values: (number | null)[], inProgress: boolean[]): number | null {
  const complete = values.filter((v, i): v is number => v !== null && !inProgress[i]);
  return complete.length > 0 ? complete.reduce((s, v) => s + v, 0) / complete.length : null;
}

/** "+4.2M" / "−0.2M" / "+850k" — signed compact amount for chart annotations. */
export function signedCompact(value: number): string {
  const sign = value < 0 ? "−" : "+";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return `${sign}${Math.round(abs)}`;
}

export type CategoryRowInput = { id: string; name: string; budget: number; months: (number | null)[] };

export type CategoryRowStats = {
  id: string;
  name: string;
  budget: number;
  /** Average over complete months with spend. */
  avg: number | null;
  /** Last complete month's spend. */
  last: number | null;
  /** Running month's spend so far (null when the window has no running month). */
  current: number | null;
  overBudgetOnAverage: boolean;
};

export function categoryRowStats(row: CategoryRowInput, inProgress: boolean[]): CategoryRowStats {
  const lastComplete = inProgress.lastIndexOf(false);
  const running = inProgress.indexOf(true);
  const avg = completeAverage(row.months, inProgress);
  return {
    id: row.id,
    name: row.name,
    budget: row.budget,
    avg,
    last: lastComplete === -1 ? null : row.months[lastComplete] ?? null,
    current: running === -1 ? null : row.months[running] ?? null,
    overBudgetOnAverage: avg !== null && row.budget > 0 && avg > row.budget,
  };
}

/** Rows sorted by average spend (biggest first); running-month-only rows last. */
export function sortByAverage(rows: CategoryRowStats[]): CategoryRowStats[] {
  return [...rows].sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || (b.current ?? 0) - (a.current ?? 0));
}
