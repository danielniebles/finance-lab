import type { InstallmentRow, MonthSummary, DueThisMonth } from "@/lib/queries/installments";

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

// ─── Month summary computation (pure, client-safe) ────────────────────────────

/** Returns true if the nth payment (1-based) of an installment falls in the given month/year. */
export function isDueInMonth(
  startDate: Date,
  installmentNum: number,
  month: number,
  year: number,
): boolean {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + (installmentNum - 1));
  return d.getMonth() + 1 === month && d.getFullYear() === year;
}

/**
 * Pure synchronous computation of MonthSummary from a pre-fetched installments array.
 * Client-safe — no DB access. Used for client-side filtering.
 */
export function computeMonthSummary(
  month: number,
  year: number,
  installments: InstallmentRow[],
): MonthSummary {
  const dueThisMonth: DueThisMonth[] = [];

  for (const inst of installments) {
    for (let n = 1; n <= inst.numInstallments; n++) {
      if (isDueInMonth(inst.startDate, n, month, year)) {
        const payment = inst.payments.find((p) => p.installmentNum === n) ?? null;
        dueThisMonth.push({
          installment: inst,
          installmentNum: n,
          amount: computeInstallmentDue(
            inst.totalAmount,
            inst.numInstallments,
            n,
            inst.monthlyInterestRate,
          ),
          payment: payment ? { id: payment.id, paidAt: payment.paidAt } : null,
        });
      }
    }
  }

  const totalObligation = dueThisMonth.reduce((s, d) => s + d.amount, 0);
  const totalPaid = dueThisMonth
    .filter((d) => d.payment !== null)
    .reduce((s, d) => s + d.amount, 0);
  const totalDue = totalObligation - totalPaid;
  const activeCount = installments.filter((i) => i.status === "Active").length;
  const totalRemainingDebt = installments.reduce((s, i) => s + i.remaining, 0);

  dueThisMonth.sort((a, b) => {
    if (a.payment === null && b.payment !== null) return -1;
    if (a.payment !== null && b.payment === null) return 1;
    return 0;
  });

  return { totalObligation, totalPaid, totalDue, activeCount, totalRemainingDebt, dueThisMonth };
}

/**
 * Unpaid slots due before (month, year), oldest first. They aren't part of
 * that month's list (computeMonthSummary), so a slot nobody has paid yet —
 * typically a debtor's — would otherwise drop out of sight once its month
 * has passed.
 */
export function overdueSlots(month: number, year: number, installments: InstallmentRow[]): DueThisMonth[] {
  const viewed = year * 12 + (month - 1);
  const slots: DueThisMonth[] = [];
  for (const inst of installments) {
    for (let n = 1; n <= inst.numInstallments; n++) {
      const d = new Date(inst.startDate);
      d.setMonth(d.getMonth() + (n - 1));
      const at = d.getFullYear() * 12 + d.getMonth();
      if (at >= viewed) break;
      if (inst.payments.some((p) => p.installmentNum === n)) continue;
      slots.push({
        installment: inst,
        installmentNum: n,
        amount: computeInstallmentDue(inst.totalAmount, inst.numInstallments, n, inst.monthlyInterestRate),
        payment: null,
        overdueFrom: { month: d.getMonth() + 1, year: d.getFullYear() },
      });
    }
  }
  const key = (s: DueThisMonth) => (s.overdueFrom ? s.overdueFrom.year * 12 + s.overdueFrom.month : 0);
  return slots.sort((a, b) => key(a) - key(b));
}
