// Loan ↔ Transaction links (ADR-060): money lent leaves a wallet, and money
// repaid arrives in one, through real Transactions — so both show on the
// ledger. Loans and repayments point at them via transactionId and stop
// counting on their own (wallet-balance-utils.ts). Both are moves of your own
// money, not spending or income: their transactions are isTransfer, filed
// under the "Loans" category.
// Server-only helpers that run inside a caller's db.$transaction.

import type { db } from "@/lib/db";
import { TransactionSource } from "@/generated/prisma";

/** The `tx` client a `db.$transaction(async (tx) => …)` callback receives. */
export type TransactionClient = Omit<typeof db, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/** Category every loan and repayment transaction is filed under. Created on first use. */
export const LOANS_CATEGORY_NAME = "Loans";

/** Below this, a shrunk transaction counts as empty (amounts are Float pesos). */
const EMPTY_AMOUNT = 0.5;

/** The "Loans" category, as a transfer category: kept out of manual pickers and of analysis. */
export async function loansCategoryId(tx: TransactionClient): Promise<string> {
  const category = await tx.appCategory.upsert({
    where: { name: LOANS_CATEGORY_NAME },
    create: { name: LOANS_CATEGORY_NAME, isTransfer: true },
    update: { isTransfer: true },
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

async function walletName(tx: TransactionClient, walletId: string): Promise<string> {
  const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: walletId }, select: { name: true } });
  return wallet.name;
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
      isTransfer: true,
    },
  });
  return tx.loan.create({
    data: { ...data, walletId: wallet.id, transactionId: transaction.id },
  });
}

export type RepaymentSplit = { loanId: string; walletId: string | null; accountId: string; amount: number };

/**
 * Records repayments split across a debtor's loans. The money lands where it
 * always has — each loan's wallet — through one incoming "Loans" transaction
 * per wallet, which every payment in it links to. Returns the created payments.
 */
export async function createRepayments(
  tx: TransactionClient,
  data: { debtorName: string; splits: RepaymentSplit[]; date: Date; notes?: string },
) {
  const byWallet = new Map<string, { name: string; splits: RepaymentSplit[] }>();
  for (const split of data.splits) {
    const wallet = split.walletId
      ? { id: split.walletId, name: await walletName(tx, split.walletId) }
      : await loanSourceWallet(tx, split.accountId);
    const key = wallet.id ?? `account:${split.accountId}`;
    const group = byWallet.get(key) ?? { name: wallet.name, splits: [] };
    group.splits.push(split);
    byWallet.set(key, group);
  }

  const appCategoryId = await loansCategoryId(tx);
  const created = [];
  for (const [key, group] of byWallet) {
    const transaction = await tx.transaction.create({
      data: {
        amount: group.splits.reduce((s, p) => s + p.amount, 0),
        date: data.date,
        appCategoryId,
        wallet: group.name,
        walletId: key.startsWith("account:") ? null : key,
        note: data.notes ? `Repayment from ${data.debtorName} — ${data.notes}` : `Repayment from ${data.debtorName}`,
        source: TransactionSource.MANUAL,
        isTransfer: true,
      },
    });
    for (const split of group.splits) {
      created.push(
        await tx.loanPayment.create({
          data: { loanId: split.loanId, amount: split.amount, date: data.date, notes: data.notes, transactionId: transaction.id },
        }),
      );
    }
  }
  return created;
}

/**
 * Takes `share` (signed like the transaction) out of a linked transaction:
 * shrinks it, or deletes it once nothing is left.
 */
export async function shrinkTransaction(tx: TransactionClient, transactionId: string, share: number) {
  const transaction = await tx.transaction.findUnique({ where: { id: transactionId }, select: { amount: true } });
  if (!transaction) return;
  const left = transaction.amount - share;
  if (Math.abs(left) < EMPTY_AMOUNT) {
    await tx.transaction.delete({ where: { id: transactionId } });
  } else {
    await tx.transaction.update({ where: { id: transactionId }, data: { amount: left } });
  }
}

export type RemoveLoanOptions = {
  /** Keep the outgoing transaction: the money did leave. */
  keepOutgoing: boolean;
  /** Keep each repayment's share of its incoming transaction: that money did come in. */
  keepRepayments: boolean;
  /** Mark the installment slots paid under this loan unpaid again. */
  unmarkSlots: boolean;
};

/**
 * Deletes a loan (its payment rows cascade) and, unless kept, the money it
 * moved: its outgoing transaction, and each repayment's share of its incoming
 * one. With `unmarkSlots`, the installment slots it paid go back to unpaid.
 */
export async function removeLoan(tx: TransactionClient, id: string, opts: RemoveLoanOptions) {
  const loan = await tx.loan.findUniqueOrThrow({
    where: { id },
    select: { transactionId: true, payments: { select: { amount: true, transactionId: true } } },
  });
  if (opts.unmarkSlots) await tx.installmentPayment.deleteMany({ where: { loanId: id } });
  await tx.loan.delete({ where: { id } });
  if (loan.transactionId && !opts.keepOutgoing) {
    await tx.transaction.delete({ where: { id: loan.transactionId } });
  }
  if (opts.keepRepayments) return;
  for (const payment of loan.payments) {
    if (payment.transactionId) await shrinkTransaction(tx, payment.transactionId, payment.amount);
  }
}
