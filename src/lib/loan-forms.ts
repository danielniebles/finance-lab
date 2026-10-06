// Rules behind the Savings & Loans forms. Pure and client-safe so the
// dialogs stay presentational and these can be unit-tested.

import type { AccountWithBalance, DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";

export type PaymentSplit = { loan: LoanWithRemaining; apply: number };

export type PaymentAllocation = {
  splits: PaymentSplit[];
  /** What the debtor still owes on the loans in scope. */
  owed: number;
  /** Part of the amount no loan can take (more than they owe). */
  unallocated: number;
};

/**
 * How `recordPayment` will split an amount: active loans in scope (one
 * account, or all when accountId is empty), newest loan first.
 */
export function allocatePayment(
  debtor: DebtorWithLoans | undefined,
  accountId: string,
  amount: number,
): PaymentAllocation {
  if (!debtor) return { splits: [], owed: 0, unallocated: 0 };
  const loans = debtor.loans
    .filter((l) => l.isActive && l.remaining > 0 && (!accountId || l.accountId === accountId))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const owed = loans.reduce((s, l) => s + l.remaining, 0);
  if (!(amount > 0)) return { splits: [], owed, unallocated: 0 };
  let left = amount;
  const splits: PaymentSplit[] = [];
  for (const loan of loans) {
    if (left <= 0) break;
    const apply = Math.min(left, loan.remaining);
    splits.push({ loan, apply });
    left -= apply;
  }
  return { splits, owed, unallocated: Math.max(0, left) };
}

/** Accounts the debtor has an open loan from. */
export function accountsWithOpenLoans(debtor: DebtorWithLoans | undefined, accounts: AccountWithBalance[]) {
  if (!debtor) return [];
  const ids = new Set(debtor.loans.filter((l) => l.isActive).map((l) => l.accountId));
  return accounts.filter((a) => ids.has(a.id));
}

/** What's missing before a payment can be recorded ("" when ready). */
export function paymentMissingHint(debtorId: string, amount: number, allocation: PaymentAllocation): string {
  if (!debtorId) return "Pick who paid.";
  if (!(amount > 0)) return "Add the amount received.";
  if (allocation.unallocated > 0) return "That's more than they owe.";
  return "";
}

/** What's missing before a transfer can be made ("" when ready). */
export function transferMissingHint(fromId: string, toId: string, amount: number): string {
  if (!fromId || !toId) return "Pick both accounts.";
  if (fromId === toId) return "Pick two different accounts.";
  if (!(amount > 0)) return "Add an amount.";
  return "";
}

/** Destination after the source changes: never the same account as the source. */
export function nextTransferTarget(fromId: string, toId: string, accounts: { id: string }[]): string {
  if (toId && toId !== fromId) return toId;
  return accounts.find((a) => a.id !== fromId)?.id ?? "";
}

/**
 * A loan can't be edited below what's already been repaid: the payments
 * would add up to more than the loan.
 */
export function loanAmountError(amount: number, editing: LoanWithRemaining | null | undefined): string | undefined {
  if (!editing || !(amount > 0)) return undefined;
  return amount < editing.paid ? "Less than what's already been repaid." : undefined;
}

/** What's missing before a loan can be saved ("" when ready). */
export function loanMissingHint(fields: { debtorId: string; accountId: string; amount: string }): string {
  if (!fields.debtorId) return "Pick who you lent to.";
  if (!fields.accountId) return "Pick the account it came from.";
  if (!(parseFloat(fields.amount) > 0)) return "Add an amount.";
  return "";
}

export type EntryDirection = "add" | "deduct";

/** An account entry is typed as a positive amount plus a direction. */
export function signedEntryAmount(digits: string, direction: EntryDirection): number {
  const n = parseFloat(digits);
  if (!(n > 0)) return NaN;
  return direction === "deduct" ? -n : n;
}
