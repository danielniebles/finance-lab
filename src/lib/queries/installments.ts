import { db } from "@/lib/db";
import { computeInstallmentDue, computeMonthSummary, isDueInMonth } from "@/lib/installment-utils";

export type InstallmentStatus = "Active" | "Finished";

export type InstallmentRow = {
  id: string;
  description: string;
  totalAmount: number;
  numInstallments: number;
  monthlyAmount: number;
  monthlyInterestRate: number | null; // % m.v. (mensual vencido), null = no interest
  startDate: Date;
  endDate: Date; // date of the last payment (computed)
  notes: string | null;
  installmentsPaid: number;
  remaining: number;
  status: InstallmentStatus;
  payments: { id: string; installmentNum: number; paidAt: Date }[];
  // credit card / debtor / funding account links
  cardId: string | null;
  cardName: string | null;
  cardColor: string | null;
  debtorId: string | null;
  debtorName: string | null;
  fundingAccountId: string | null;
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


export async function getAllInstallments(): Promise<InstallmentRow[]> {
  const rows = await db.installment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      payments: { orderBy: { installmentNum: "asc" } },
      card: { select: { id: true, name: true, color: true } },
      debtor: { select: { id: true, name: true } },
    },
  });

  return rows
    .map((r) => {
      const installmentsPaid = r.payments.length;
      const remaining = Math.max(0, r.totalAmount - installmentsPaid * r.monthlyAmount);
      const status: InstallmentStatus = remaining <= 0 ? "Finished" : "Active";

      const endDate = new Date(r.startDate);
      endDate.setMonth(endDate.getMonth() + r.numInstallments - 1);

      return {
        id: r.id,
        description: r.description,
        totalAmount: r.totalAmount,
        numInstallments: r.numInstallments,
        monthlyAmount: r.monthlyAmount,
        monthlyInterestRate: r.monthlyInterestRate,
        startDate: r.startDate,
        endDate,
        notes: r.notes,
        installmentsPaid,
        remaining,
        status,
        payments: r.payments.map((p) => ({
          id: p.id,
          installmentNum: p.installmentNum,
          paidAt: p.paidAt,
        })),
        cardId: r.cardId,
        cardName: r.card?.name ?? null,
        cardColor: r.card?.color ?? null,
        debtorId: r.debtorId,
        debtorName: r.debtor?.name ?? null,
        fundingAccountId: r.fundingAccountId,
      };
    })
    // Active first, Finished at the bottom
    .sort((a, b) => {
      if (a.status === "Active" && b.status === "Finished") return -1;
      if (a.status === "Finished" && b.status === "Active") return 1;
      return 0;
    });
}

/**
 * Builds the monthly summary.
 * Pass a pre-fetched `installments` array to avoid a second DB round-trip
 * when the caller already has it (e.g. the dashboard page).
 */
export async function getMonthSummary(
  month: number,
  year: number,
  installments?: InstallmentRow[],
): Promise<MonthSummary> {
  const all = installments ?? await getAllInstallments();
  return computeMonthSummary(month, year, all);
}

// ─── Credit Card summaries ────────────────────────────────────────────────────

export type CreditCardSummary = {
  id: string;
  name: string;
  color: string | null;
  creditLimit: number | null;
  paymentDueDay: number | null;
  /** Sum of remaining capital across active installments on this card (ADR-006: never stored). */
  outstandingDebt: number;
  /** Sum of computeInstallmentDue(k) for each active installment's slot due in the given month. */
  monthlyObligation: number;
  /** Count of active (not fully paid) installments on this card. */
  installmentCount: number;
};

export async function getCardSummaries(
  month: number,
  year: number
): Promise<CreditCardSummary[]> {
  const cards = await db.creditCard.findMany({
    orderBy: { name: "asc" },
    include: {
      installments: {
        include: { payments: { orderBy: { installmentNum: "asc" } } },
      },
    },
  });

  return cards.map((card) => {
    let outstandingDebt = 0;
    let monthlyObligation = 0;
    let installmentCount = 0;

    for (const inst of card.installments) {
      const paidCount = inst.payments.length;
      const remainingSlots = inst.numInstallments - paidCount;
      if (remainingSlots <= 0) continue;

      installmentCount += 1;
      outstandingDebt += inst.monthlyAmount * remainingSlots;

      // Find the slot k that falls in the given month/year
      for (let k = 1; k <= inst.numInstallments; k++) {
        if (isDueInMonth(inst.startDate, k, month, year)) {
          // Only count if this slot is not yet paid
          const isPaid = inst.payments.some((p) => p.installmentNum === k);
          if (!isPaid) {
            monthlyObligation += computeInstallmentDue(
              inst.totalAmount,
              inst.numInstallments,
              k,
              inst.monthlyInterestRate ?? undefined,
            );
          }
          break;
        }
      }
    }

    return {
      id: card.id,
      name: card.name,
      color: card.color,
      creditLimit: card.creditLimit,
      paymentDueDay: card.paymentDueDay,
      outstandingDebt,
      monthlyObligation,
      installmentCount,
    };
  });
}

// ─── Form data helpers ────────────────────────────────────────────────────────

export async function getInstallmentFormData() {
  const [cards, debtors, accounts] = await Promise.all([
    db.creditCard.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
    db.debtor.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.savingsAccount.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { cards, debtors, accounts };
}
