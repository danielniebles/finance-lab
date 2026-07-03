"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
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
