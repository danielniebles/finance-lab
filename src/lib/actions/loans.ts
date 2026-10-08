"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { AccountType, EntryType } from "@/generated/prisma";
import { createLoanWithTransaction, loanSourceWallet } from "@/lib/loan-ledger";

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
  includeInOverviewTotal: boolean;
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
  data: {
    name: string;
    accountType: AccountType;
    color: string;
    includeInAvailable: boolean;
    includeInOverviewTotal: boolean;
  }
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

/**
 * Entries and wallets go with the account (cascade). Loans and transfers
 * don't: while any exist the database refuses, so this checks first and
 * says why instead of failing silently. Returns `{ error }` rather than
 * throwing, since thrown messages are hidden from the client in production.
 */
export async function deleteAccount(id: string): Promise<{ error?: string }> {
  const [loans, transfers] = await Promise.all([
    db.loan.count({ where: { accountId: id } }),
    db.transfer.count({ where: { OR: [{ fromAccountId: id }, { toAccountId: id }] } }),
  ]);
  if (loans > 0 || transfers > 0) {
    const parts = [
      loans > 0 ? `${loans} ${loans === 1 ? "loan" : "loans"}` : null,
      transfers > 0 ? `${transfers} ${transfers === 1 ? "transfer" : "transfers"}` : null,
    ].filter(Boolean);
    return { error: `It still has ${parts.join(" and ")}. Delete or move those first.` };
  }
  try {
    await db.savingsAccount.delete({ where: { id } });
  } catch {
    return { error: "Its wallets are still used by transactions or vaults, so it can't be deleted." };
  }
  revalidatePath(PATH);
  return {};
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

/** `notes: null` clears them (undefined would leave the old notes in place). */
export async function updateDebtor(id: string, data: { name: string; notes: string | null }) {
  await db.debtor.update({ where: { id }, data });
  revalidatePath(PATH);
}

export async function deleteDebtor(id: string) {
  await db.debtor.delete({ where: { id } });
  revalidatePath(PATH);
}

// ─── Loans ────────────────────────────────────────────────────────────────────

/**
 * Money lent leaves the account's savings wallet through a linked "Loans"
 * transaction (ADR-060), so it shows on that wallet's ledger.
 */
export async function createLoan(data: {
  debtorId: string;
  accountId: string;
  amount: number;
  date: Date;
  expectedBy?: Date;
  notes?: string;
}) {
  const created = await db.$transaction((tx) => createLoanWithTransaction(tx, data));
  revalidateLoanViews();
  return created;
}

/**
 * Re-resolves walletId (ADR-036/037) to the (possibly new) account's savings
 * wallet, and keeps the linked transaction (ADR-060) in step: amount and date
 * always, wallet only when the account changed (a "Pay all" loan's
 * transaction may come from a wallet the user picked).
 * `expectedBy: null` / `notes: null` clear the field; undefined would keep the old value.
 */
export async function updateLoan(
  id: string,
  data: { accountId: string; amount: number; date: Date; expectedBy: Date | null; notes: string | null }
) {
  await db.$transaction(async (tx) => {
    const [before, wallet] = await Promise.all([
      tx.loan.findUniqueOrThrow({ where: { id }, select: { accountId: true, transactionId: true } }),
      loanSourceWallet(tx, data.accountId),
    ]);
    await tx.loan.update({ where: { id }, data: { ...data, walletId: wallet.id } });
    if (!before.transactionId) return;
    const accountChanged = before.accountId !== data.accountId;
    await tx.transaction.update({
      where: { id: before.transactionId },
      data: {
        amount: -data.amount,
        date: data.date,
        ...(accountChanged ? { walletId: wallet.id, wallet: wallet.name } : {}),
      },
    });
  });
  revalidateLoanViews();
}

/**
 * Deletes a loan (its payments cascade). Its linked transaction goes too
 * unless `keepTransaction` — then the money stays spent and the loan simply
 * stops being owed (ADR-060).
 */
export async function deleteLoan(id: string, opts: { keepTransaction?: boolean } = {}) {
  await db.$transaction(async (tx) => {
    const loan = await tx.loan.delete({ where: { id }, select: { transactionId: true } });
    if (loan.transactionId && !opts.keepTransaction) {
      await tx.transaction.delete({ where: { id: loan.transactionId } });
    }
  });
  revalidateLoanViews();
}

/** A loan's transaction moves a wallet balance, so every view showing one refreshes. */
function revalidateLoanViews() {
  revalidatePath(PATH);
  revalidatePath("/expenses");
  revalidatePath("/overview");
  revalidatePath("/trends");
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
