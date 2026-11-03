import { getFinancialPeriodBounds } from "@/lib/financial-period-utils";
import { getBills } from "@/lib/queries/bills";
import { comparePeriodToDate, loadFlows, type PeriodToDateComparison } from "@/lib/queries/period-comparison";
import { cumulativeSpendByDay, periodLength } from "@/lib/spending-pace-display";

export type SpendingPace = PeriodToDateComparison & {
  /** Cumulative spend per day of this period, up to today. */
  currentCurve: number[];
  /** Cumulative spend per day of the whole previous period. */
  previousCurve: number[];
  /** Categories with a bill still unpaid this period. */
  unpaidBillCategories: string[];
};

/**
 * Trends › Pace: the Advisor's compare_period_to_date for today's period
 * (optionally one wallet), plus the day-by-day curves for the chart.
 */
export async function getSpendingPace(walletId?: string, now = new Date()): Promise<SpendingPace | { error: string }> {
  const comparison = await comparePeriodToDate({ walletId }, now);
  if ("error" in comparison) return comparison;

  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const prev = getFinancialPeriodBounds(comparison.previous.month, comparison.previous.year, startDay);
  const [flows, bills] = await Promise.all([
    loadFlows(prev.start, comparison.current.until, walletId),
    getBills(comparison.current.month, comparison.current.year),
  ]);

  return {
    ...comparison,
    currentCurve: cumulativeSpendByDay(flows, comparison.current.from, comparison.day),
    previousCurve: cumulativeSpendByDay(flows, prev.start, periodLength(prev.start, prev.end)),
    unpaidBillCategories: bills.open ? bills.bills.filter((b) => !b.paid).map((b) => b.category.name) : [],
  };
}
