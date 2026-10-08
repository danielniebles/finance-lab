// Loan ↔ Transaction link (ADR-060): money lent leaves a wallet through a real
// Transaction, so it shows on the ledger; the loan points at it via
// transactionId and stops subtracting on its own (wallet-balance-utils.ts).
// Server-only helpers that run inside a caller's db.$transaction.

import type { db } from "@/lib/db";
import { TransactionSource } from "@/generated/prisma";

/** The `tx` client a `db.$transaction(async (tx) => …)` callback receives. */
type TransactionClient = Omit<typeof db, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/** Category every manual loan's transaction is filed under. Created on first use. */
export const LOANS_CATEGORY_NAME = "Loans";

async function loansCategoryId(tx: TransactionClient): Promise<string> {
  const category = await tx.appCategory.upsert({
    where: { name: LOANS_CATEGORY_NAME },
    create: { name: LOANS_CATEGORY_NAME },
    update: {},
    select: { id: true },
  });
  return category.id;
}

/** The wallet a loan from this account leaves (its savings wallet), with its name for Transaction.wallet. */
export async function loanSourceWallet(
  tx: TransactionClient,
  accountId: string,
): Promise<{ id: string | null; name: string }> {
  const account = await tx.savingsAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { name: true, savingsWallet: { select: { id: true, name: true } } },
  });
  return { id: account.savingsWallet?.id ?? null, name: account.savingsWallet?.name ?? account.name };
}

/**
 * Creates a loan plus the "Loans" transaction its money leaves through
 * (−amount on the account's savings wallet), linked. Used by the loan form,
 * the Advisor and a single "Mark paid" on a debtor's installment.
 */
export async function createLoanWithTransaction(
  tx: TransactionClient,
  data: {
    debtorId: string;
    accountId: string;
    amount: number;
    date: Date;
    expectedBy?: Date;
    notes?: string;
  },
) {
  const [wallet, appCategoryId, debtor] = await Promise.all([
    loanSourceWallet(tx, data.accountId),
    loansCategoryId(tx),
    tx.debtor.findUniqueOrThrow({ where: { id: data.debtorId }, select: { name: true } }),
  ]);
  const transaction = await tx.transaction.create({
    data: {
      amount: -data.amount,
      date: data.date,
      appCategoryId,
      wallet: wallet.name,
      walletId: wallet.id,
      note: data.notes ? `Loan to ${debtor.name} — ${data.notes}` : `Loan to ${debtor.name}`,
      source: TransactionSource.MANUAL,
    },
  });
  return tx.loan.create({
    data: { ...data, walletId: wallet.id, transactionId: transaction.id },
  });
}
