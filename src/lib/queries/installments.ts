import { db } from "@/lib/db";

export type InstallmentStatus = "Active" | "Finished";

export type InstallmentRow = {
  id: string;
  description: string;
  totalAmount: number;
  numInstallments: number;
  monthlyAmount: number;
  startDate: Date;
  notes: string | null;
  installmentsPaid: number;
  remaining: number;
  status: InstallmentStatus;
  payments: { id: string; installmentNum: number; paidAt: Date }[];
};

export type MonthSummary = {
  totalObligation: number;
  totalPaid: number;
  totalDue: number;
  activeCount: number;
  totalRemainingDebt: number;
  dueThisMonth: DueThisMonth[];
};

export type DueThisMonth = {
  installment: InstallmentRow;
  installmentNum: number; // which payment number (1-based)
  amount: number;
  payment: { id: string; paidAt: Date } | null; // null = unpaid
};

/** Returns the Date of the nth payment (1-based) for a given installment. */
export function paymentDate(startDate: Date, installmentNum: number): Date {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + (installmentNum - 1));
  return d;
}

/** Returns true if the nth payment falls in the given month/year. */
function isDueInMonth(
  startDate: Date,
  installmentNum: number,
  month: number,
  year: number
): boolean {
  const d = paymentDate(startDate, installmentNum);
  return d.getMonth() + 1 === month && d.getFullYear() === year;
}

export async function getAllInstallments(): Promise<InstallmentRow[]> {
  const rows = await db.installment.findMany({
    orderBy: { createdAt: "desc" },
    include: { payments: { orderBy: { installmentNum: "asc" } } },
  });

  return rows
    .map((r) => {
    const installmentsPaid = r.payments.length;
    const remaining = Math.max(0, r.totalAmount - installmentsPaid * r.monthlyAmount);
    const status: InstallmentStatus = remaining <= 0 ? "Finished" : "Active";
    return {
      id: r.id,
      description: r.description,
      totalAmount: r.totalAmount,
      numInstallments: r.numInstallments,
      monthlyAmount: r.monthlyAmount,
      startDate: r.startDate,
      notes: r.notes,
      installmentsPaid,
      remaining,
      status,
      payments: r.payments.map((p) => ({
        id: p.id,
        installmentNum: p.installmentNum,
        paidAt: p.paidAt,
      })),
    };
    })
    // Active first, Finished at the bottom
    .sort((a, b) => {
      if (a.status === "Active" && b.status === "Finished") return -1;
      if (a.status === "Finished" && b.status === "Active") return 1;
      return 0;
    });
}

export async function getMonthSummary(
  month: number,
  year: number
): Promise<MonthSummary> {
  const installments = await getAllInstallments();

  const dueThisMonth: DueThisMonth[] = [];

  for (const inst of installments) {
    for (let n = 1; n <= inst.numInstallments; n++) {
      if (isDueInMonth(inst.startDate, n, month, year)) {
        const payment = inst.payments.find((p) => p.installmentNum === n) ?? null;
        dueThisMonth.push({
          installment: inst,
          installmentNum: n,
          amount: inst.monthlyAmount,
          payment: payment
            ? { id: payment.id, paidAt: payment.paidAt }
            : null,
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

  // Unpaid first, paid at the bottom
  dueThisMonth.sort((a, b) => {
    if (a.payment === null && b.payment !== null) return -1;
    if (a.payment !== null && b.payment === null) return 1;
    return 0;
  });

  return {
    totalObligation,
    totalPaid,
    totalDue,
    activeCount,
    totalRemainingDebt,
    dueThisMonth,
  };
}
