"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { TransactionSource } from "@/generated/prisma";
import { computeInstallmentDue, computeMonthlyAmount } from "@/lib/installment-utils";
import { installmentLoanNote, payAllGroup } from "@/lib/installment-display";
import {
  createLoanWithTransaction,
  loanSourceWallet,
  loansCategoryId,
  removeLoan,
  shrinkTransaction,
  type TransactionClient,
} from "@/lib/loan-ledger";

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
    // If this installment tracks a debtor + funding account, auto-create a
    // loan — and the transaction its money leaves through (ADR-060) — and
    // link the slot to it so unmarking takes it back out.
    let loanId: string | null = null;
    if (inst.debtorId && inst.fundingAccountId) {
      const loan = await createLoanWithTransaction(tx, {
        debtorId: inst.debtorId,
        accountId: inst.fundingAccountId,
        amount: slotDue(inst, installmentNum),
        date: paidAt,
        notes: installmentLoanNote([{ installmentNum, numInstallments: inst.numInstallments, description: inst.description }]),
      });
      loanId = loan.id;
      loanCreated = true;
      debtorName = inst.debtor?.name;
    }
    await tx.installmentPayment.create({
      data: { installmentId, installmentNum, paidAt, loanId },
    });
  });

  if (loanCreated) revalidateMoneyViews();
  else revalidatePath(PATH);

  return { loanCreated, debtorName };
}

/** What one slot of an installment costs (German amortization when it has interest). */
function slotDue(
  inst: { totalAmount: number; numInstallments: number; monthlyInterestRate: number | null },
  installmentNum: number,
): number {
  return computeInstallmentDue(inst.totalAmount, inst.numInstallments, installmentNum, inst.monthlyInterestRate ?? undefined);
}

/**
 * Takes an unmarked slot's share back out of the loan it was paid under
 * (ADR-060): the loan and its outgoing transaction shrink by the slot's
 * amount, or go entirely when it was the loan's last slot. Repayments
 * already received stay — that money did come in.
 */
async function releaseLoanShare(tx: TransactionClient, loanId: string, amount: number) {
  const loan = await tx.loan.findUnique({
    where: { id: loanId },
    select: { amount: true, transactionId: true, _count: { select: { installmentPayments: true } } },
  });
  if (!loan) return;
  if (loan._count.installmentPayments === 0) {
    await removeLoan(tx, loanId, { keepOutgoing: false, keepRepayments: true, unmarkSlots: false });
    return;
  }
  await tx.loan.update({ where: { id: loanId }, data: { amount: loan.amount - amount } });
  if (loan.transactionId) await shrinkTransaction(tx, loan.transactionId, -amount);
}

/**
 * Deletes slot payments and gives back what they moved: a debtor's slot
 * releases its loan share, an own "Pay all" slot comes out of that payment's
 * transaction. Returns whether any money moved.
 */
async function removeSlotPayments(where: { id: string } | { installmentId: string; installmentNum: number }) {
  return db.$transaction(async (tx) => {
    const payments = await tx.installmentPayment.findMany({ where, include: { installment: true } });
    await tx.installmentPayment.deleteMany({ where: { id: { in: payments.map((p) => p.id) } } });
    for (const p of payments) {
      const due = slotDue(p.installment, p.installmentNum);
      if (p.loanId) await releaseLoanShare(tx, p.loanId, due);
      if (p.transactionId) await shrinkTransaction(tx, p.transactionId, -due);
    }
    return payments.some((p) => p.loanId || p.transactionId);
  });
}

export async function unmarkPayment(paymentId: string) {
  const touchedLoan = await removeSlotPayments({ id: paymentId });
  if (touchedLoan) revalidateMoneyViews();
  else revalidatePath(PATH);
}

/** Undo variant: delete by installmentId + installmentNum (used by agent undo). */
export async function unmarkPaymentBySlot(installmentId: string, installmentNum: number) {
  const touchedLoan = await removeSlotPayments({ installmentId, installmentNum });
  if (touchedLoan) revalidateMoneyViews();
  else revalidatePath(PATH);
}

/**
 * "Pay all" — marks a batch of selected installment slots (from the Due This
 * Month table) as paid in one go, AND records a single MANUAL Transaction for
 * the combined amount so the payment shows up on the wallet's ledger.
 *
 * The selection must be one group (payAllGroup, ADR-060): only your own
 * installments, or only one debtor's. A debtor's batch becomes ONE loan for
 * the total, linked to that transaction — so loan and transaction always
 * match, and deleting the loan can take its transaction with it. That
 * transaction is lending, not spending: filed under "Loans" as a transfer,
 * whatever category was picked (the dialog doesn't ask for one then).
 */
export async function payInstallmentsBulk(
  items: { installmentId: string; installmentNum: number }[],
  data: {
    walletId: string;
    wallet: string;
    appCategoryId: string | null;
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
    return [{ inst, installmentNum: item.installmentNum, amount: slotDue(inst, item.installmentNum) }];
  });

  const group = payAllGroup(slots.map((s) => s.inst));
  if (group.kind === "mixed") {
    throw new Error("Pay your own installments and each person's separately");
  }
  if (group.kind === "own" && !data.appCategoryId) throw new Error("Pick a category");
  const totalAmount = slots.reduce((sum, s) => sum + s.amount, 0);
  const lending = group.kind === "debtor";

  await db.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        amount: -totalAmount,
        date: data.date,
        appCategoryId: lending ? await loansCategoryId(tx) : data.appCategoryId,
        isTransfer: lending,
        wallet: data.wallet,
        walletId: data.walletId,
        note: data.note,
        source: TransactionSource.MANUAL,
        batchId: null,
        externalId: null,
        moneyLoverCategoryId: null,
      },
    });

    let loanId: string | null = null;
    if (group.kind === "debtor") {
      // walletId = the funding account's savings wallet: where repayments land.
      const wallet = await loanSourceWallet(tx, group.fundingAccountId);
      const loan = await tx.loan.create({
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
      loanId = loan.id;
    }

    // A debtor's slots go through their loan; your own through the payment itself.
    await tx.installmentPayment.createMany({
      data: slots.map((s) => ({
        installmentId: s.inst.id,
        installmentNum: s.installmentNum,
        paidAt: data.date,
        loanId,
        transactionId: loanId ? null : transaction.id,
      })),
    });
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
