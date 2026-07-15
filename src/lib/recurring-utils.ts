// Pure math utilities for the Recurring Expenses module — client-safe, no DB imports.
// Mirror of installment-utils.ts / vault-utils.ts pattern.

import { financialMonthYear } from "./financial-period-utils";

/**
 * Whole (financial) months remaining from (month, year) through nextDueDate,
 * inclusive of the current month — mirrors vault-utils.ts's monthsLeft.
 * nextDueDate is first classified via financialMonthYear(startDay), so a
 * mid-month startDay (e.g. 25) shifts late-month due dates into the next
 * financial month, same as everywhere else in the app. Pass startDay=1 (the
 * default) for plain calendar-month behavior.
 * Minimum return value is 1 (so monthlySetAside is never Infinity).
 *
 * "Inclusive of the current month" means: if nextDueDate is in the same
 * financial month, diff = 0 → we return 1 (pay it now); if it's in the next
 * financial month, diff = 1 → we return 2 (spread over this month + next).
 */
export function monthsUntilDue(
  nextDueDate: Date,
  month: number,
  year: number,
  startDay: number = 1,
): number {
  const { month: dMonth, year: dYear } = financialMonthYear(nextDueDate, startDay);
  const diff = (dYear - year) * 12 + (dMonth - month);
  return Math.max(1, diff + 1);
}

/**
 * Per-item monthly set-aside for the given month.
 *   = estimatedAmount / monthsUntilDue(nextDueDate, month, year, startDay)
 */
export function monthlySetAside(
  estimatedAmount: number,
  nextDueDate: Date,
  month: number,
  year: number,
  startDay: number = 1,
): number {
  return estimatedAmount / monthsUntilDue(nextDueDate, month, year, startDay);
}

/**
 * Returns true if nextDueDate falls within the given financial (month, year).
 */
export function isDueInMonth(
  nextDueDate: Date,
  month: number,
  year: number,
  startDay: number = 1,
): boolean {
  const { month: dMonth, year: dYear } = financialMonthYear(nextDueDate, startDay);
  return dMonth === month && dYear === year;
}

/**
 * Returns a new date = nextDueDate advanced by cadenceMonths months.
 * Used after recording a payment to roll the cycle forward.
 */
export function rollCycle(nextDueDate: Date, cadenceMonths: number): Date {
  const result = new Date(nextDueDate);
  result.setMonth(result.getMonth() + cadenceMonths);
  return result;
}
