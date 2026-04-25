// ─── Rate conversion helpers ──────────────────────────────────────────────────

/**
 * Converts an effective annual rate (EA) to a monthly effective rate.
 *   r_monthly = (1 + EA/100)^(1/12) - 1
 */
export function eaToMonthly(annualEA: number): number {
  return Math.pow(1 + annualEA / 100, 1 / 12) - 1;
}

/**
 * Converts a monthly effective rate (m.v.) to an effective annual rate (EA).
 *   EA = (1 + r_monthly/100)^12 - 1   (result as a percentage)
 */
export function monthlyToEA(monthlyRate: number): number {
  return (Math.pow(1 + monthlyRate / 100, 12) - 1) * 100;
}

// ─── Amortization ─────────────────────────────────────────────────────────────

/**
 * Capital per installment — stored as monthlyAmount in the DB.
 * Always P/n regardless of interest rate.
 * (German system: fixed capital + variable interest on top.)
 */
export function computeMonthlyAmount(
  totalAmount: number,
  numInstallments: number,
): number {
  return Math.round(totalAmount / numInstallments);
}

/**
 * Actual total amount due for installment number k (1-based).
 *
 * German amortization (cuota decreciente):
 *   capital   = P / n                                (fixed)
 *   balance_k = P × (n − k + 1) / n                 (decreasing)
 *   interest_k = balance_k × (monthlyRate / 100)     (decreasing)
 *   total_k   = capital + interest_k                 (decreasing)
 *
 * When monthlyInterestRate is null/0 → total_k = capital = P/n.
 *
 * Pure function — safe in server components, queries, and client components.
 */
export function computeInstallmentDue(
  totalAmount: number,
  numInstallments: number,
  installmentNum: number,
  monthlyInterestRate?: number | null,
): number {
  const capital = Math.round(totalAmount / numInstallments);
  if (!monthlyInterestRate || monthlyInterestRate === 0) return capital;
  const balance = totalAmount * (numInstallments - installmentNum + 1) / numInstallments;
  return Math.round(capital + balance * (monthlyInterestRate / 100));
}
