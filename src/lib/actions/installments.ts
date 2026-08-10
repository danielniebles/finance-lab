"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { TransactionSource } from "@/generated/prisma";
import { computeInstallmentDue, computeMonthlyAmount } from "@/lib/installment-utils";

export async function createInstallment(data: {
  description: string;
  totalAmount: number;
  numInstallments: number;
  startDate: Date;
  notes?: string;
  monthlyInterestRate?: number | null;
  cardId?: string | null;
  debtorId?: string | null;
  fundingAccountId?: string | null;
}) {
  const monthlyAmount = computeMonthlyAmount(data.totalAmount, data.numInstallments);
  const created = await db.installment.create({
    data: {
      description: data.description,
      totalAmount: data.totalAmount,
      numInstallments: data.numInstallments,
      monthlyAmount,
      monthlyInterestRate: data.monthlyInterestRate ?? null,
      startDate: data.startDate,
      notes: data.notes ?? null,
      cardId: data.cardId ?? null,
      debtorId: data.debtorId ?? null,
      fundingAccountId: data.fundingAccountId ?? null,
    },
  });
  revalidatePath("/installments");
  return created;
}

export async function updateInstallment(
  id: string,
  data: {
    description: string;
    totalAmount: number;
    numInstallments: number;
    startDate: Date;
    notes?: string;
    monthlyInterestRate?: number | null;
    cardId?: string | null;
    debtorId?: string | null;
    fundingAccountId?: string | null;
  }
) {
  const monthlyAmount = computeMonthlyAmount(data.totalAmount, data.numInstallments);
  await db.installment.update({
    where: { id },
    data: {
      description: data.description,
      totalAmount: data.totalAmount,
      numInstallments: data.numInstallments,
      monthlyAmount,
      monthlyInterestRate: data.monthlyInterestRate ?? null,
      startDate: data.startDate,
      notes: data.notes ?? null,
      cardId: data.cardId ?? null,
      debtorId: data.debtorId ?? null,
      fundingAccountId: data.fundingAccountId ?? null,
    },
  });
  revalidatePath("/installments");
}

export async function deleteInstallment(id: string) {
  await db.installment.delete({ where: { id } });
  revalidatePath("/installments");
}

export async function markPayment(
  installmentId: string,
  installmentNum: number,
  paidAt: Date
): Promise<{ loanCreated: boolean; debtorName?: string }> {
  // Fetch the installment with its debtor and fundingAccount to decide auto-loan
  const inst = await db.installment.findUniqueOrThrow({
    where: { id: installmentId },
    include: {
      debtor: { select: { id: true, name: true } },
    },
  });

  let loanCreated = false;
  let debtorName: string | undefined;

  await db.$transaction(async (tx) => {
    // 1. Record the installment payment
    await tx.installmentPayment.create({
      data: { installmentId, installmentNum, paidAt },
    });

    // 2. If this installment tracks a debtor + funding account, auto-create a loan
    if (inst.debtorId && inst.fundingAccountId) {
      const amount = computeInstallmentDue(
        inst.totalAmount,
        inst.numInstallments,
        installmentNum,
        inst.monthlyInterestRate ?? undefined,
      );
      await tx.loan.create({
        data: {
          debtorId: inst.debtorId,
          accountId: inst.fundingAccountId,
          amount,
          date: paidAt,
          notes: `Cuota ${installmentNum}/${inst.numInstallments} — ${inst.description}`,
        },
      });
      loanCreated = true;
      debtorName = inst.debtor?.name;
    }
  });

  revalidatePath("/installments");
  revalidatePath("/loans");

  return { loanCreated, debtorName };
}

export async function unmarkPayment(paymentId: string) {
  await db.installmentPayment.delete({ where: { id: paymentId } });
  revalidatePath("/installments");
}

/** Undo variant: delete by installmentId + installmentNum (used by agent undo). */
export async function unmarkPaymentBySlot(installmentId: string, installmentNum: number) {
  await db.installmentPayment.deleteMany({ where: { installmentId, installmentNum } });
  revalidatePath("/installments");
}

/**
 * "Pay all" — marks a batch of selected installment slots (from the Due This
 * Month table) as paid in one go, AND records a single MANUAL Transaction for
 * the combined amount so the payment shows up on the wallet's ledger, same as
 * markPayment does per-slot for the auto-loan case, but batched into one
 * ledger entry instead of one per slot.
 */
export async function payInstallmentsBulk(
  items: { installmentId: string; installmentNum: number }[],
  data: {
    walletId: string;
    wallet: string;
    appCategoryId: string;
    date: Date;
    note: string;
  },
): Promise<{ loansCreated: number }> {
  if (items.length === 0) throw new Error("No installments selected");

  const installments = await db.installment.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.installmentId))] } },
    include: { debtor: { select: { id: true, name: true } } },
  });
  const byId = new Map(installments.map((inst) => [inst.id, inst]));

  let loansCreated = 0;
  let totalAmount = 0;

  await db.$transaction(async (tx) => {
    for (const item of items) {
      const inst = byId.get(item.installmentId);
      if (!inst) continue;

      await tx.installmentPayment.create({
        data: {
          installmentId: item.installmentId,
          installmentNum: item.installmentNum,
          paidAt: data.date,
        },
      });

      const amount = computeInstallmentDue(
        inst.totalAmount,
        inst.numInstallments,
        item.installmentNum,
        inst.monthlyInterestRate ?? undefined,
      );
      totalAmount += amount;

      if (inst.debtorId && inst.fundingAccountId) {
        await tx.loan.create({
          data: {
            debtorId: inst.debtorId,
            accountId: inst.fundingAccountId,
            amount,
            date: data.date,
            notes: `Cuota ${item.installmentNum}/${inst.numInstallments} — ${inst.description}`,
          },
        });
        loansCreated++;
      }
    }

    await tx.transaction.create({
      data: {
        amount: -totalAmount,
        date: data.date,
        appCategoryId: data.appCategoryId,
        wallet: data.wallet,
        walletId: data.walletId,
        note: data.note,
        source: TransactionSource.MANUAL,
        batchId: null,
        externalId: null,
        moneyLoverCategoryId: null,
      },
    });
  });

  revalidatePath("/installments");
  revalidatePath("/loans");
  revalidatePath("/expenses");
  revalidatePath("/overview");
  revalidatePath("/trends");

  return { loansCreated };
}

// ─── Credit Card CRUD ─────────────────────────────────────────────────────────

export async function createCard(data: {
  name: string;
  creditLimit?: number;
  billingClosingDay?: number;
  paymentDueDay?: number;
  color?: string;
}) {
  const created = await db.creditCard.create({
    data: {
      name: data.name,
      creditLimit: data.creditLimit ?? null,
      billingClosingDay: data.billingClosingDay ?? null,
      paymentDueDay: data.paymentDueDay ?? null,
      color: data.color ?? null,
    },
  });
  revalidatePath("/installments");
  return created;
}

export async function updateCard(
  id: string,
  data: {
    name: string;
    creditLimit?: number;
    billingClosingDay?: number;
    paymentDueDay?: number;
    color?: string;
  }
) {
  await db.creditCard.update({
    where: { id },
    data: {
      name: data.name,
      creditLimit: data.creditLimit ?? null,
      billingClosingDay: data.billingClosingDay ?? null,
      paymentDueDay: data.paymentDueDay ?? null,
      color: data.color ?? null,
    },
  });
  revalidatePath("/installments");
}

export async function deleteCard(id: string) {
  await db.creditCard.delete({ where: { id } });
  revalidatePath("/installments");
}
