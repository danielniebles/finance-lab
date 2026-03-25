"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { AccountType, EntryType } from "@/generated/prisma/enums";

const PATH = "/loans";

// ─── Accounts ────────────────────────────────────────────────────────────────

export async function createAccount(data: {
  name: string;
  accountType: AccountType;
  color: string;
  includeInAvailable: boolean;
  initialBalance?: number;
  initialDate?: Date;
}) {
  const { initialBalance, initialDate, ...accountData } = data;
  const account = await db.savingsAccount.create({ data: accountData });
  if (initialBalance !== undefined && initialBalance !== 0) {
    await db.accountEntry.create({
      data: {
        accountId: account.id,
        type: EntryType.INITIAL,
        amount: initialBalance,
        date: initialDate ?? new Date(),
        notes: "Initial balance",
      },
    });
  }
  revalidatePath(PATH);
}

export async function updateAccount(
  id: string,
  data: { name: string; accountType: AccountType; color: string; includeInAvailable: boolean }
) {
  await db.savingsAccount.update({ where: { id }, data });
  revalidatePath(PATH);
}

export async function deleteAccount(id: string) {
  await db.savingsAccount.delete({ where: { id } });
  revalidatePath(PATH);
}

// ─── Account entries (initial / adjustments) ─────────────────────────────────

export async function createEntry(data: {
  accountId: string;
  type: EntryType;
  amount: number;
  date: Date;
  notes?: string;
}) {
  await db.accountEntry.create({ data });
  revalidatePath(PATH);
}

export async function deleteEntry(id: string) {
  await db.accountEntry.delete({ where: { id } });
  revalidatePath(PATH);
}

// ─── Transfers ────────────────────────────────────────────────────────────────

export async function createTransfer(data: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: Date;
  notes?: string;
}) {
  await db.transfer.create({ data });
  revalidatePath(PATH);
}

export async function deleteTransfer(id: string) {
  await db.transfer.delete({ where: { id } });
  revalidatePath(PATH);
}

// ─── Debtors ──────────────────────────────────────────────────────────────────

export async function createDebtor(data: { name: string; notes?: string }) {
  await db.debtor.create({ data });
  revalidatePath(PATH);
}

export async function updateDebtor(id: string, data: { name: string; notes?: string }) {
  await db.debtor.update({ where: { id }, data });
  revalidatePath(PATH);
}

export async function deleteDebtor(id: string) {
  await db.debtor.delete({ where: { id } });
  revalidatePath(PATH);
}

// ─── Loans ────────────────────────────────────────────────────────────────────

export async function createLoan(data: {
  debtorId: string;
  accountId: string;
  amount: number;
  date: Date;
  expectedBy?: Date;
  notes?: string;
}) {
  await db.loan.create({ data });
  revalidatePath(PATH);
}

export async function updateLoan(
  id: string,
  data: { accountId: string; amount: number; date: Date; expectedBy?: Date; notes?: string }
) {
  await db.loan.update({ where: { id }, data });
  revalidatePath(PATH);
}

export async function deleteLoan(id: string) {
  await db.loan.delete({ where: { id } });
  revalidatePath(PATH);
}

// ─── Payments (FIFO per debtor) ───────────────────────────────────────────────

export async function recordPayment(data: {
  debtorId: string;
  totalAmount: number;
  date: Date;
  notes?: string;
}) {
  // Fetch all loans for debtor ordered oldest first
  const loans = await db.loan.findMany({
    where: { debtorId: data.debtorId },
    include: { payments: true },
    orderBy: { date: "asc" },
  });

  const active = loans
    .map((l) => ({
      id: l.id,
      remaining: Math.max(0, l.amount - l.payments.reduce((s, p) => s + p.amount, 0)),
    }))
    .filter((l) => l.remaining > 0);

  let left = data.totalAmount;
  const toCreate: { loanId: string; amount: number; date: Date; notes?: string }[] = [];

  for (const loan of active) {
    if (left <= 0) break;
    const apply = Math.min(left, loan.remaining);
    toCreate.push({ loanId: loan.id, amount: apply, date: data.date, notes: data.notes });
    left -= apply;
  }

  if (toCreate.length > 0) {
    await db.loanPayment.createMany({ data: toCreate });
  }
  revalidatePath(PATH);
  return { allocated: data.totalAmount - left, unallocated: left, splits: toCreate.length };
}

export async function deleteLoanPayment(id: string) {
  await db.loanPayment.delete({ where: { id } });
  revalidatePath(PATH);
}
