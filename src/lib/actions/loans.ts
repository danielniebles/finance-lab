"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { AccountType, EntryType } from "@/generated/prisma";

const PATH = "/loans";

// ─── Accounts ────────────────────────────────────────────────────────────────

/**
 * Creates a new SavingsAccount AND its single default Wallet (ADR-036/037 —
 * an account with no split always has exactly one wallet). The wallet's
 * openingBalance is 0 and openingDate is the account's opening date (the
 * same date the INITIAL entry is dated, or now) — a brand-new account has no
 * pre-migration history to protect against, so there's no reconciliation gap
 * to anchor against, unlike the C1 migration's existing accounts. Wrapped in
 * a transaction: an account with no wallet is a broken invariant everywhere
 * balances are computed.
 */
export async function createAccount(data: {
  name: string;
  accountType: AccountType;
  color: string;
  includeInAvailable: boolean;
  initialBalance?: number;
  initialDate?: Date;
}) {
  const { initialBalance, initialDate, includeInAvailable, ...accountData } = data;
  const openingDate = initialDate ?? new Date();

  await db.$transaction(async (tx) => {
    const account = await tx.savingsAccount.create({ data: accountData });

    const wallet = await tx.wallet.create({
      data: {
        accountId: account.id,
        name: account.name,
        isSavings: true,
        includeInAvailable,
        openingBalance: 0,
        openingDate,
      },
    });

    await tx.savingsAccount.update({
      where: { id: account.id },
      data: { savingsWalletId: wallet.id, defaultWalletId: wallet.id },
    });

    if (initialBalance !== undefined && initialBalance !== 0) {
      await tx.accountEntry.create({
        data: {
          accountId: account.id,
          type: EntryType.INITIAL,
          amount: initialBalance,
          date: openingDate,
          notes: "Initial balance",
        },
      });
    }
  });

  revalidatePath(PATH);
}

/**
 * `includeInAvailable` now lives on Wallet (ADR-036), not SavingsAccount.
 * This legacy account-level checkbox edits only the account's savings
 * wallet — for a single-wallet account that's the whole story (identical to
 * pre-migration behavior); for a multi-partition account (Bancolombia) it's
 * a deliberate stopgap that leaves the other partitions' flags untouched,
 * pending the real per-wallet settings screen (HANDOFF open question #6, C2).
 */
export async function updateAccount(
  id: string,
  data: { name: string; accountType: AccountType; color: string; includeInAvailable: boolean }
) {
  const { includeInAvailable, ...accountData } = data;
  const account = await db.savingsAccount.update({ where: { id }, data: accountData });
  if (account.savingsWalletId) {
    await db.wallet.update({
      where: { id: account.savingsWalletId },
      data: { includeInAvailable },
    });
  }
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
  const created = await db.accountEntry.create({ data });
  revalidatePath(PATH);
  return created;
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
  const created = await db.transfer.create({ data });
  revalidatePath(PATH);
  return created;
}

export async function deleteTransfer(id: string) {
  await db.transfer.delete({ where: { id } });
  revalidatePath(PATH);
}

// ─── Debtors ──────────────────────────────────────────────────────────────────

export async function createDebtor(data: { name: string; notes?: string }) {
  const created = await db.debtor.create({ data });
  revalidatePath(PATH);
  return created;
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

/**
 * walletId (ADR-036/037) defaults to the account's savingsWalletId — C1
 * always sources a loan from the account's savings partition; per-transaction
 * wallet selection is a C2 follow-up (HANDOFF §1).
 */
export async function createLoan(data: {
  debtorId: string;
  accountId: string;
  amount: number;
  date: Date;
  expectedBy?: Date;
  notes?: string;
}) {
  const account = await db.savingsAccount.findUniqueOrThrow({
    where: { id: data.accountId },
    select: { savingsWalletId: true },
  });
  const created = await db.loan.create({
    data: { ...data, walletId: account.savingsWalletId },
  });
  revalidatePath(PATH);
  return created;
}

/** Re-resolves walletId (ADR-036/037) to the (possibly new) account's savingsWalletId. */
export async function updateLoan(
  id: string,
  data: { accountId: string; amount: number; date: Date; expectedBy?: Date; notes?: string }
) {
  const account = await db.savingsAccount.findUniqueOrThrow({
    where: { id: data.accountId },
    select: { savingsWalletId: true },
  });
  await db.loan.update({ where: { id }, data: { ...data, walletId: account.savingsWalletId } });
  revalidatePath(PATH);
}

export async function deleteLoan(id: string) {
  await db.loan.delete({ where: { id } });
  revalidatePath(PATH);
}

// ─── Payments (LIFO per debtor — newest debt paid first) ─────────────────────

export async function recordPayment(data: {
  debtorId: string;
  accountId?: string;
  totalAmount: number;
  date: Date;
  notes?: string;
}) {
  // Fetch loans for debtor (optionally scoped to one account), newest first
  const loans = await db.loan.findMany({
    where: { debtorId: data.debtorId, ...(data.accountId ? { accountId: data.accountId } : {}) },
    include: { payments: true },
    orderBy: { date: "desc" },
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

/** Records a payment directly against a specific loan (used by agent proposals). Returns created payment. */
export async function recordLoanPayment(data: {
  loanId: string;
  amount: number;
  date: Date;
  notes?: string;
}) {
  const created = await db.loanPayment.create({ data });
  revalidatePath(PATH);
  return created;
}

export async function deleteLoanPayment(id: string) {
  await db.loanPayment.delete({ where: { id } });
  revalidatePath(PATH);
}

export async function deleteSettledLoans(debtorId: string) {
  const loans = await db.loan.findMany({
    where: { debtorId },
    include: { payments: { select: { amount: true } } },
  });
  const settledIds = loans
    .filter((l) => l.payments.reduce((s, p) => s + p.amount, 0) >= l.amount)
    .map((l) => l.id);
  if (settledIds.length > 0) {
    await db.loan.deleteMany({ where: { id: { in: settledIds } } });
  }
  revalidatePath(PATH);
}
