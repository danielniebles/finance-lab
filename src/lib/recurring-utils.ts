// Pure math utilities for the Recurring Expenses module — client-safe, no DB imports.
// Mirror of installment-utils.ts / vault-utils.ts pattern.

/**
 * Whole months from the start of (month, year) until nextDueDate.
 * Minimum return value is 1 (so monthlySetAside is never Infinity).
 *
 * "From the start of the given month" means: if nextDueDate is in the same
 * month, diff = 0 → we return 1 (pay it now).
 */
export function monthsUntilDue(
  nextDueDate: Date,
  month: number,
  year: number,
): number {
  const dYear = nextDueDate.getFullYear();
  const dMonth = nextDueDate.getMonth() + 1; // 1-based
  const diff = (dYear - year) * 12 + (dMonth - month);
  return Math.max(1, diff);
}

/**
 * Per-item monthly set-aside for the given month.
 *   = estimatedAmount / monthsUntilDue(nextDueDate, month, year)
 */
export function monthlySetAside(
  estimatedAmount: number,
  nextDueDate: Date,
  month: number,
  year: number,
): number {
  return estimatedAmount / monthsUntilDue(nextDueDate, month, year);
}

/**
 * Returns true if nextDueDate falls within the given month/year.
 */
export function isDueInMonth(
  nextDueDate: Date,
  month: number,
  year: number,
): boolean {
  return (
    nextDueDate.getMonth() + 1 === month &&
    nextDueDate.getFullYear() === year
  );
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
