/**
 * Pure balance math for the Wallet model (ADR-036/037, Milestone C1).
 *
 * balance = openingBalance + Σ(flows dated on/after openingDate). EVERY flow
 * term is guarded by the SAME openingDate — pre-epoch flows are already
 * folded into openingBalance (it was set from the account's real balance at
 * migration time), so counting a pre-epoch flow again would double-count.
 * See ADR-037 and .handoff/wallets-model/HANDOFF.md for the full model.
 *
 * Mirrors vault-utils.ts / installment-utils.ts: pure math, no Prisma import,
 * safe to import anywhere (server or client) and to unit-test directly.
 */

export type DatedFlow = { date: Date; amount: number };

function sumSince(flows: DatedFlow[], openingDate: Date): number {
  return flows
    .filter((f) => f.date >= openingDate)
    .reduce((sum, f) => sum + f.amount, 0);
}

export type WalletBalanceInputs = {
  openingBalance: number;
  openingDate: Date;
  /** Transaction rows whose walletId is this wallet (signed: income +, expense −). */
  transactions: DatedFlow[];
  /** Loan rows whose walletId is this wallet (money lent out — subtracted). */
  loansGiven: DatedFlow[];
  /** LoanPayment rows belonging to loans whose walletId is this wallet (money repaid in). */
  loanPayments: DatedFlow[];
  /** VaultEntry rows whose sourceWalletId is this wallet (money earmarked out — subtracted). */
  vaultFunded: DatedFlow[];
  /**
   * AccountEntry rows for this wallet's account. AccountEntry isn't
   * wallet-aware yet (C2/C3 — HANDOFF §3c), so its whole effect attributes
   * to the account's savingsWalletId wallet. Pass [] for every other wallet
   * on the same account.
   */
  accountEntries: DatedFlow[];
  /** Transfer rows landing on this wallet's account — same savingsWalletId-only rule as accountEntries. */
  transfersIn: DatedFlow[];
  /** Transfer rows leaving this wallet's account — same savingsWalletId-only rule as accountEntries. */
  transfersOut: DatedFlow[];
};

export function computeWalletBalance(inputs: WalletBalanceInputs): number {
  const { openingBalance, openingDate } = inputs;
  return (
    openingBalance +
    sumSince(inputs.transactions, openingDate) -
    sumSince(inputs.loansGiven, openingDate) +
    sumSince(inputs.loanPayments, openingDate) -
    sumSince(inputs.vaultFunded, openingDate) +
    sumSince(inputs.accountEntries, openingDate) +
    sumSince(inputs.transfersIn, openingDate) -
    sumSince(inputs.transfersOut, openingDate)
  );
}

/**
 * Groups a flat list of wallet-tagged rows by walletId — e.g. Transaction
 * rows fetched with `walletId: { not: null }`. Rows with a null walletId are
 * dropped (nothing to attribute them to yet — see the migration's
 * "unassigned" note in HANDOFF §2 step 4).
 */
export function groupByWalletId<T extends { walletId: string | null; date: Date; amount: number }>(
  rows: T[],
): Map<string, DatedFlow[]> {
  const map = new Map<string, DatedFlow[]>();
  for (const row of rows) {
    if (!row.walletId) continue;
    const list = map.get(row.walletId) ?? [];
    list.push({ date: row.date, amount: row.amount });
    map.set(row.walletId, list);
  }
  return map;
}


/** A Wallet row's balance-relevant fields (subset of the Prisma Wallet model). */
export type WalletForBalance = {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isSavings: boolean;
  includeInAvailable: boolean;
  openingBalance: number;
  openingDate: Date;
};

/**
 * The SavingsAccount shape `computeWalletBalancesForAccount` needs: its
 * wallets plus every relation whose rows get attributed to one of them.
 * Structurally compatible with the (differently-shaped) Prisma `include`
 * results in wallets.ts/loans.ts/accounts.ts — extra fields on the real
 * query results are ignored.
 */
export type AccountForWalletBalances = {
  savingsWalletId: string | null;
  wallets: WalletForBalance[];
  loansGiven: { walletId: string | null; amount: number; date: Date; payments: DatedFlow[] }[];
  /**
   * transactionId set means this entry created a real Transaction — that
   * money is already reflected in `transactions` via the normal sum, so it's
   * excluded here to avoid subtracting it twice.
   */
  vaultEntriesFunded: { sourceWalletId: string | null; amount: number; date: Date; transactionId: string | null }[];
  entries: DatedFlow[];
  transfersTo: DatedFlow[];
  transfersFrom: DatedFlow[];
};

export type WalletBalanceResult = WalletForBalance & { balance: number };

/**
 * Computes every wallet's balance for one account (ADR-036/037). Shared by
 * getWalletBalances(), getLoansOverview()'s buildWalletRollups(), and
 * getSavingsAccounts() — all three need the exact same per-wallet
 * attribution rule (loans/vault entries gated by a walletId match,
 * account-level entries/transfers attributed only to the savingsWalletId
 * wallet). Previously each reimplemented this reduce independently, which
 * risked drift if the attribution rule ever changes (e.g. C3's wallet-aware
 * Transfer).
 */
export function computeWalletBalancesForAccount(
  account: AccountForWalletBalances,
  transactionsByWallet: Map<string, DatedFlow[]>,
): WalletBalanceResult[] {
  return account.wallets.map((w) => {
    const isSavingsWallet = w.id === account.savingsWalletId;
    const balance = computeWalletBalance({
      openingBalance: w.openingBalance,
      openingDate: w.openingDate,
      transactions: transactionsByWallet.get(w.id) ?? [],
      loansGiven: account.loansGiven.filter((l) => l.walletId === w.id),
      loanPayments: account.loansGiven
        .filter((l) => l.walletId === w.id)
        .flatMap((l) => l.payments),
      vaultFunded: account.vaultEntriesFunded.filter((v) => v.sourceWalletId === w.id && !v.transactionId),
      accountEntries: isSavingsWallet ? account.entries : [],
      transfersIn: isSavingsWallet ? account.transfersTo : [],
      transfersOut: isSavingsWallet ? account.transfersFrom : [],
    });
    return { ...w, balance };
  });
}
