/**
 * Computes the fixed monthly payment for an installment.
 * - No rate (or 0%): simple split — totalAmount / n, rounded.
 * - With rate: standard amortization formula — P * r / (1 - (1+r)^-n).
 *
 * Pure function — safe to import in both server actions and client components.
 */
export function computeMonthlyAmount(
  totalAmount: number,
  numInstallments: number,
  annualInterestRate?: number | null,
): number {
  if (!annualInterestRate || annualInterestRate === 0) {
    return Math.round(totalAmount / numInstallments);
  }
  const r = annualInterestRate / 100 / 12;
  return Math.round(
    (totalAmount * r) / (1 - Math.pow(1 + r, -numInstallments)),
  );
}
