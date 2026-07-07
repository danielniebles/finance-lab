// Pure date-math utilities for resolving "financial month" period boundaries —
// client-safe, no DB imports. Mirrors the vault-utils.ts / forecast-utils.ts
// pattern of small, pure, testable helper modules.
//
// The app's "month" is not necessarily the calendar month: FINANCIAL_MONTH_START_DAY
// (see parse-moneylover.ts's financialMonthYear) lets a period start mid-month, e.g.
// startDay=25 means the period for financial month "March" runs Feb 25 → Mar 24.
// This module is the inverse: given a target (month, year), compute the date
// bounds so callers can filter transactions by date range instead of by ImportBatch.

/**
 * Given a financial month/year and the configured start day, returns the
 * half-open date range `[start, end)` that the period covers.
 *
 * - `start` is `startDay` of the previous calendar month (inclusive).
 * - `end` is `startDay` of the target calendar month (exclusive) — i.e. one
 *   millisecond before `end` is the last instant of the period.
 *
 * When `startDay <= 1`, the period is exactly the calendar month
 * (`[1st 00:00, 1st of next month 00:00)`), matching financialMonthYear's
 * behavior of treating every day as belonging to its own calendar month.
 *
 * Use as `date >= start && date < end` (Prisma: `{ gte: start, lt: end }`).
 */
export function getFinancialPeriodBounds(
  month: number,
  year: number,
  startDay = 1,
): { start: Date; end: Date } {
  // startDay <= 1 means every day belongs to its own calendar month (no
  // "advance" — see financialMonthYear's early-return branch), so the period
  // is exactly [1st of month, 1st of next month).
  if (startDay <= 1) {
    return {
      start: new Date(year, month - 1, 1),
      end: new Date(year, month, 1),
    };
  }

  // Otherwise the period runs from `startDay` of the previous calendar month
  // (inclusive) to `startDay` of the target calendar month (exclusive) — e.g.
  // startDay=25 means financial March = [Feb 25, Mar 25).
  return {
    start: new Date(year, month - 2, startDay),
    end: new Date(year, month - 1, startDay),
  };
}
