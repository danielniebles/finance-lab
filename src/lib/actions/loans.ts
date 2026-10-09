"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { AccountType, EntryType } from "@/generated/prisma";
import {
  createLoanWithTransaction,
  createRepayments,
  loanSourceWallet,
  removeLoan,
  shrinkTransaction,
  type RepaymentSplit,
} from "@/lib/loan-ledger";

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
 * A historical loan with neither wallet nor transaction stays that way: its
 * money already left before it was recorded, so giving it a wallet would
 * subtract it a second time (ADR-060).
 * `expectedBy: null` / `notes: null` clear the field; undefined would keep the old value.
 */
export async function updateLoan(
  id: string,
  data: { accountId: string; amount: number; date: Date; expectedBy: Date | null; notes: string | null }
) {
  await db.$transaction(async (tx) => {
    const [before, wallet] = await Promise.all([
      tx.loan.findUniqueOrThrow({ where: { id }, select: { accountId: true, transactionId: true, walletId: true } }),
      loanSourceWallet(tx, data.accountId),
    ]);
    const historical = !before.walletId && !before.transactionId;
    await tx.loan.update({ where: { id }, data: { ...data, walletId: historical ? null : wallet.id } });
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
 * Deletes a loan (ADR-060). Two intents:
 * - a mistake (default): its outgoing transaction goes and the installment
 *   slots it paid go back to unpaid — as if it never happened;
 * - `keepTransaction` (the debt is forgiven): the money did leave, so the
 *   transaction stays and the slots stay paid; the loan just stops being owed.
 * Repayments received stay in the balance unless `deleteRepayments`.
 */
export async function deleteLoan(id: string, opts: { keepTransaction?: boolean; deleteRepayments?: boolean } = {}) {
  const keepOutgoing = opts.keepTransaction ?? false;
  await db.$transaction((tx) =>
    removeLoan(tx, id, { keepOutgoing, unmarkSlots: !keepOutgoing, keepRepayments: !opts.deleteRepayments }),
  );
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

/**
 * Splits an amount across the debtor's active loans, newest first, and
 * records it with its incoming transaction(s) (ADR-060). Anything beyond what
 * they owe is left unallocated — not recorded.
 */
export async function recordPayment(data: {
  debtorId: string;
  accountId?: string;
  totalAmount: number;
  date: Date;
  notes?: string;
}) {
  const debtor = await db.debtor.findUniqueOrThrow({
    where: { id: data.debtorId },
    select: {
      name: true,
      loans: {
        where: data.accountId ? { accountId: data.accountId } : {},
        include: { payments: true },
        orderBy: { date: "desc" },
      },
    },
  });

  const active = debtor.loans
    .map((l) => ({
      loanId: l.id,
      walletId: l.walletId,
      accountId: l.accountId,
      remaining: Math.max(0, l.amount - l.payments.reduce((s, p) => s + p.amount, 0)),
    }))
    .filter((l) => l.remaining > 0);

  let left = data.totalAmount;
  const splits: RepaymentSplit[] = [];
  for (const { remaining, ...loan } of active) {
    if (left <= 0) break;
    const amount = Math.min(left, remaining);
    splits.push({ ...loan, amount });
    left -= amount;
  }

  if (splits.length > 0) {
    await db.$transaction((tx) =>
      createRepayments(tx, { debtorName: debtor.name, splits, date: data.date, notes: data.notes }),
    );
  }
  revalidateLoanViews();
  return { allocated: data.totalAmount - left, unallocated: left, splits: splits.length };
}

/** Records a payment directly against a specific loan (used by agent proposals). Returns created payment. */
export async function recordLoanPayment(data: {
  loanId: string;
  amount: number;
  date: Date;
  notes?: string;
}) {
  const loan = await db.loan.findUniqueOrThrow({
    where: { id: data.loanId },
    select: { walletId: true, accountId: true, debtor: { select: { name: true } } },
  });
  const [created] = await db.$transaction((tx) =>
    createRepayments(tx, {
      debtorName: loan.debtor.name,
      splits: [{ loanId: data.loanId, walletId: loan.walletId, accountId: loan.accountId, amount: data.amount }],
      date: data.date,
      notes: data.notes,
    }),
  );
  revalidateLoanViews();
  return created;
}

/** Deletes a repayment and takes its share out of its incoming transaction (ADR-060). */
export async function deleteLoanPayment(id: string) {
  await db.$transaction(async (tx) => {
    const payment = await tx.loanPayment.delete({ where: { id }, select: { amount: true, transactionId: true } });
    if (payment.transactionId) await shrinkTransaction(tx, payment.transactionId, payment.amount);
  });
  revalidateLoanViews();
}
