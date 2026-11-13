import { db } from "@/lib/db";
import { computeWalletBalancesForAccount, groupByWalletId, walletExistedAt } from "@/lib/wallet-balance-utils";
import type { WalletSettingsAccount } from "@/lib/wallet-settings-display";

export type WalletBalance = {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isSavings: boolean;
  includeInAvailable: boolean;
  balance: number;
};

export type AccountWithWallets = {
  id: string;
  name: string;
  accountType: "BANK" | "DIGITAL" | "PENSION";
  color: string | null;
  // Gates membership in `grandTotal` below — an account the user doesn't
  // want folded into the headline number (e.g. a pension account) is still
  // listed here, just excluded from the sum.
  includeInOverviewTotal: boolean;
  balance: number; // Σ this account's wallets
  wallets: WalletBalance[];
};

export type WalletBalancesResult = {
  accounts: AccountWithWallets[];
  grandTotal: number; // Σ wallet.balance for accounts with includeInOverviewTotal (Home number)
};

/** Loads the rows `buildWalletBalances` needs — load once for several cutoffs. */
export async function loadWalletBalanceSources() {
  const [accounts, walletTransactions] = await Promise.all([
    db.savingsAccount.findMany({
      include: {
        wallets: { orderBy: { sortOrder: "asc" } },
        entries: true,
        loansGiven: { include: { payments: true } },
        transfersFrom: true,
        transfersTo: true,
        vaultEntriesFunded: true,
      },
      orderBy: { name: "asc" },
    }),
    db.transaction.findMany({
      where: { walletId: { not: null } },
      select: { walletId: true, date: true, amount: true },
    }),
  ]);
  return { accounts, transactionsByWallet: groupByWalletId(walletTransactions) };
}

export type WalletBalanceSources = Awaited<ReturnType<typeof loadWalletBalanceSources>>;

/**
 * Pure assembly of `getWalletBalances`' result from already-loaded rows, so a
 * caller needing balances at several cutoffs loads once. With `asOf`
 * (exclusive) every balance is the one at the start of that instant, and
 * wallets whose balance epoch hadn't started yet are left out.
 */
export function buildWalletBalances(
  { accounts, transactionsByWallet }: WalletBalanceSources,
  asOf?: Date,
): WalletBalancesResult {
  const accountsWithWallets: AccountWithWallets[] = accounts.map((acc) => {
    const wallets: WalletBalance[] = computeWalletBalancesForAccount(acc, transactionsByWallet, asOf)
      .filter((w) => !asOf || walletExistedAt(w, asOf))
      .map((w) => ({
        id: w.id,
        name: w.name,
        color: w.color,
        sortOrder: w.sortOrder,
        isSavings: w.isSavings,
        includeInAvailable: w.includeInAvailable,
        balance: w.balance,
      }));

    return {
      id: acc.id,
      name: acc.name,
      accountType: acc.accountType as "BANK" | "DIGITAL" | "PENSION",
      color: acc.color,
      includeInOverviewTotal: acc.includeInOverviewTotal ?? true,
      balance: wallets.reduce((sum, w) => sum + w.balance, 0),
      wallets,
    };
  });

  const grandTotal = accountsWithWallets
    .filter((a) => a.includeInOverviewTotal)
    .reduce((sum, a) => sum + a.balance, 0);

  return { accounts: accountsWithWallets, grandTotal };
}

/**
 * Per-wallet balances + a grand total across every institution (ADR-036/037,
 * HANDOFF §3). This is the Home/Overview number — every partition of an
 * included account counts, grand total = the user's chosen subset of the
 * real bank balance (SavingsAccount.includeInOverviewTotal). Contrast with
 * `getLoansOverview` (`queries/loans.ts`), which reports only the
 * `isSavings` subset gated by the separate Wallet.includeInAvailable flag.
 * `asOf` (exclusive) gives the historical balances at that instant.
 */
export async function getWalletBalances(asOf?: Date): Promise<WalletBalancesResult> {
  return buildWalletBalances(await loadWalletBalanceSources(), asOf);
}

/**
 * Every account with its wallets for the Wallets settings screen: balances,
 * the editable fields (opening balance/date), which wallet is the account's
 * main/default, and what still uses each wallet (for the delete guard).
 */
export async function getWalletSettings(): Promise<WalletSettingsAccount[]> {
  const [{ accounts, transactionsByWallet }, usageRows] = await Promise.all([
    loadWalletBalanceSources(),
    db.wallet.findMany({
      select: {
        id: true,
        _count: { select: { transactions: true, loans: true, vaultEntriesFunded: true, counterpartyRules: true } },
      },
    }),
  ]);
  const usage = new Map(
    usageRows.map((w) => [
      w.id,
      {
        transactions: w._count.transactions,
        loans: w._count.loans,
        vaultEntries: w._count.vaultEntriesFunded,
        rules: w._count.counterpartyRules,
      },
    ]),
  );

  return accounts.map((acc) => {
    const wallets = computeWalletBalancesForAccount(acc, transactionsByWallet).map((w) => ({
      id: w.id,
      name: w.name,
      color: w.color,
      sortOrder: w.sortOrder,
      isSavings: w.isSavings,
      includeInAvailable: w.includeInAvailable,
      openingBalance: w.openingBalance,
      openingDate: w.openingDate,
      balance: w.balance,
      isMain: w.id === acc.savingsWalletId,
      isDefault: w.id === acc.defaultWalletId,
      usage: usage.get(w.id) ?? { transactions: 0, loans: 0, vaultEntries: 0, rules: 0 },
    }));
    return {
      id: acc.id,
      name: acc.name,
      accountType: acc.accountType as WalletSettingsAccount["accountType"],
      color: acc.color,
      includeInOverviewTotal: acc.includeInOverviewTotal ?? true,
      balance: wallets.reduce((sum, w) => sum + w.balance, 0),
      wallets,
    };
  });
}

/**
 * Cheap `{id, name}` pairs for every wallet, for a plain dropdown (e.g. the
 * counterparty-rule wallet picker) that has no use for balances. Avoids
 * `getWalletBalances()`'s full dashboard-grade computation (accounts +
 * entries + transfers + loans + vault entries + an unbounded transaction
 * scan) when only the id/name is needed — mirrors `buildWalletResolver()`'s
 * (`resolve-wallet.ts`) own cheap `findMany` for the same reason.
 */
export async function listWalletOptions(): Promise<{ id: string; name: string }[]> {
  return db.wallet.findMany({
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  });
}
