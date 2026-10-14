// Pure math for "the same point last month" comparisons — client-safe, no DB.
// Mirrors financial-period-utils.ts: the queries layer loads rows, these
// helpers window, total and diff them.
//
// A period-to-date window is the first `day` days of a FINANCIAL period, so
// day 20 of October (startDay=25) is Sep 25 → Oct 14 and day 20 of September
// is Aug 25 → Sep 13: equal-length windows, never a month-to-date figure
// against a whole month.

import { financialMonthYear, getFinancialPeriodBounds } from "@/lib/financial-period-utils";

export const UNCATEGORIZED = "Uncategorized";

export type PeriodWindow = {
  month: number;
  year: number;
  day: number;
  /** Inclusive. */
  start: Date;
  /** Exclusive; capped at the period's own end. */
  end: Date;
};

export function shiftMonth(month: number, year: number, by: number): { month: number; year: number } {
  const index = year * 12 + (month - 1) + by;
  return { month: (index % 12) + 1, year: Math.floor(index / 12) };
}

export function periodToDateWindow(month: number, year: number, day: number, startDay: number): PeriodWindow {
  const { start, end: periodEnd } = getFinancialPeriodBounds(month, year, startDay);
  const cut = new Date(start.getFullYear(), start.getMonth(), start.getDate() + day);
  return { month, year, day, start, end: cut < periodEnd ? cut : periodEnd };
}

/** Today's financial month and which day of it today is (1-based, today included). */
export function currentPeriodDay(now: Date, startDay: number): { month: number; year: number; day: number } {
  const { month, year } = financialMonthYear(now, startDay);
  const { start } = getFinancialPeriodBounds(month, year, startDay);
  // Calendar-day difference via UTC dates, so a DST shift can't skew it.
  const toDays = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  return { month, year, day: toDays(now) - toDays(start) + 1 };
}

export type CategorizedFlow = {
  date: Date;
  /** Signed: income +, expense −. */
  amount: number;
  /** Effective app category name (ADR-030); null when uncategorised. */
  category: string | null;
  /** Wallet-to-wallet leg, or a row in a transfer category: never income or spending. */
  isTransfer: boolean;
};

export type WindowTotals = {
  income: number;
  /** Positive magnitude. */
  spend: number;
  /** Signed net of transfer legs (only meaningful for one wallet). */
  transfersNet: number;
  spendByCategory: Record<string, number>;
};

export function summarizeWindow(flows: CategorizedFlow[], window: PeriodWindow): WindowTotals {
  const totals: WindowTotals = { income: 0, spend: 0, transfersNet: 0, spendByCategory: {} };
  for (const f of flows) {
    if (f.date < window.start || f.date >= window.end) continue;
    if (f.isTransfer) totals.transfersNet += f.amount;
    else if (f.amount > 0) totals.income += f.amount;
    else {
      const key = f.category ?? UNCATEGORIZED;
      totals.spend -= f.amount;
      totals.spendByCategory[key] = (totals.spendByCategory[key] ?? 0) - f.amount;
    }
  }
  return totals;
}

export type CategoryDelta = {
  category: string;
  current: number;
  previous: number;
  /** current − previous: positive = spent more this period. */
  delta: number;
  /** Mean over the baseline windows; null without a baseline. */
  baselineAvg: number | null;
};

/** Every category seen in any window, largest |delta| first. */
export function compareCategorySpend(
  current: WindowTotals,
  previous: WindowTotals,
  baseline: WindowTotals[] = [],
): CategoryDelta[] {
  const names = new Set(
    [current, previous, ...baseline].flatMap((t) => Object.keys(t.spendByCategory)),
  );
  const spendOf = (t: WindowTotals, name: string) => t.spendByCategory[name] ?? 0;
  return [...names]
    .map((category) => ({
      category,
      current: spendOf(current, category),
      previous: spendOf(previous, category),
      delta: spendOf(current, category) - spendOf(previous, category),
      baselineAvg: baseline.length
        ? baseline.reduce((s, t) => s + spendOf(t, category), 0) / baseline.length
        : null,
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.category.localeCompare(b.category));
}

export type WalletWindow = { startBalance: number; endBalance: number; totals: WindowTotals };

export type WalletChange = {
  /** current.endBalance − previous.endBalance — the headline difference. */
  endBalanceDelta: number;
  /** Difference in the balance each window started with (left over from the period before). */
  carryover: number;
  incomeDelta: number;
  /** Positive = spent more this period (it LOWERS the balance). */
  spendDelta: number;
  transfersDelta: number;
  /** Loans, repayments, vault funding, adjustments — wallet flows that aren't transactions. */
  otherFlowsDelta: number;
};

function otherFlows(w: WalletWindow): number {
  const transactionsNet = w.totals.income - w.totals.spend + w.totals.transfersNet;
  return w.endBalance - w.startBalance - transactionsNet;
}

/**
 * Splits the difference between two windows' end balances into its causes.
 * Exact by construction: endBalanceDelta = carryover + incomeDelta
 * − spendDelta + transfersDelta + otherFlowsDelta.
 */
export function decomposeWalletChange(current: WalletWindow, previous: WalletWindow): WalletChange {
  return {
    endBalanceDelta: current.endBalance - previous.endBalance,
    carryover: current.startBalance - previous.startBalance,
    incomeDelta: current.totals.income - previous.totals.income,
    spendDelta: current.totals.spend - previous.totals.spend,
    transfersDelta: current.totals.transfersNet - previous.totals.transfersNet,
    otherFlowsDelta: otherFlows(current) - otherFlows(previous),
  };
}
