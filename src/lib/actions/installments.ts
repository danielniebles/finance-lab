"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { TransactionSource } from "@/generated/prisma";
import { computeInstallmentDue, computeMonthlyAmount } from "@/lib/installment-utils";
import { installmentLoanNote, payAllGroup } from "@/lib/installment-display";
import { createLoanWithTransaction, loanSourceWallet } from "@/lib/loan-ledger";

const PATH = "/installments";

/** A payment that created a transaction or loan moves balances shown on every money view. */
function revalidateMoneyViews() {
  for (const path of [PATH, "/loans", "/expenses", "/overview", "/trends"]) revalidatePath(path);
}

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
  revalidatePath(PATH);
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
  revalidatePath(PATH);
}

export async function deleteInstallment(id: string) {
  await db.installment.delete({ where: { id } });
  revalidatePath(PATH);
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

    // 2. If this installment tracks a debtor + funding account, auto-create a
    //    loan — and the transaction its money leaves through (ADR-060).
    if (inst.debtorId && inst.fundingAccountId) {
      const amount = computeInstallmentDue(
        inst.totalAmount,
        inst.numInstallments,
        installmentNum,
        inst.monthlyInterestRate ?? undefined,
      );
      await createLoanWithTransaction(tx, {
        debtorId: inst.debtorId,
        accountId: inst.fundingAccountId,
        amount,
        date: paidAt,
        notes: installmentLoanNote([{ installmentNum, numInstallments: inst.numInstallments, description: inst.description }]),
      });
      loanCreated = true;
      debtorName = inst.debtor?.name;
    }
  });

  if (loanCreated) revalidateMoneyViews();
  else revalidatePath(PATH);

  return { loanCreated, debtorName };
}

export async function unmarkPayment(paymentId: string) {
  await db.installmentPayment.delete({ where: { id: paymentId } });
  revalidatePath(PATH);
}

/** Undo variant: delete by installmentId + installmentNum (used by agent undo). */
export async function unmarkPaymentBySlot(installmentId: string, installmentNum: number) {
  await db.installmentPayment.deleteMany({ where: { installmentId, installmentNum } });
  revalidatePath(PATH);
}

/**
 * "Pay all" — marks a batch of selected installment slots (from the Due This
 * Month table) as paid in one go, AND records a single MANUAL Transaction for
 * the combined amount so the payment shows up on the wallet's ledger.
 *
 * The selection must be one group (payAllGroup, ADR-060): only your own
 * installments, or only one debtor's. A debtor's batch becomes ONE loan for
 * the total, linked to that transaction — so loan and transaction always
 * match, and deleting the loan can take its transaction with it.
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
  });
  const byId = new Map(installments.map((inst) => [inst.id, inst]));
  const slots = items.flatMap((item) => {
    const inst = byId.get(item.installmentId);
    if (!inst) return [];
    const amount = computeInstallmentDue(
      inst.totalAmount,
      inst.numInstallments,
      item.installmentNum,
      inst.monthlyInterestRate ?? undefined,
    );
    return [{ inst, installmentNum: item.installmentNum, amount }];
  });

  const group = payAllGroup(slots.map((s) => s.inst));
  if (group.kind === "mixed") {
    throw new Error("Pay your own installments and each person's separately");
  }
  const totalAmount = slots.reduce((sum, s) => sum + s.amount, 0);

  await db.$transaction(async (tx) => {
    await tx.installmentPayment.createMany({
      data: slots.map((s) => ({ installmentId: s.inst.id, installmentNum: s.installmentNum, paidAt: data.date })),
    });

    const transaction = await tx.transaction.create({
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

    if (group.kind === "debtor") {
      // walletId = the funding account's savings wallet: where repayments land.
      const wallet = await loanSourceWallet(tx, group.fundingAccountId);
      await tx.loan.create({
        data: {
          debtorId: group.debtorId,
          accountId: group.fundingAccountId,
          walletId: wallet.id,
          transactionId: transaction.id,
          amount: totalAmount,
          date: data.date,
          notes: installmentLoanNote(
            slots.map((s) => ({ installmentNum: s.installmentNum, numInstallments: s.inst.numInstallments, description: s.inst.description })),
          ),
        },
      });
    }
  });

  revalidateMoneyViews();

  return { loansCreated: group.kind === "debtor" ? 1 : 0 };
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
  revalidatePath(PATH);
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
  revalidatePath(PATH);
}

export async function deleteCard(id: string) {
  await db.creditCard.delete({ where: { id } });
  revalidatePath(PATH);
}
