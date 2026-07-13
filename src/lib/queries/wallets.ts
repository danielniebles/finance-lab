import { db } from "@/lib/db";
import { computeWalletBalancesForAccount, groupByWalletId } from "@/lib/wallet-balance-utils";

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

/**
 * Per-wallet balances + a grand total across every institution (ADR-036/037,
 * HANDOFF §3). This is the Home/Overview number — every partition of an
 * included account counts, grand total = the user's chosen subset of the
 * real bank balance (SavingsAccount.includeInOverviewTotal). Contrast with
 * `getLoansOverview` (`queries/loans.ts`), which reports only the
 * `isSavings` subset gated by the separate Wallet.includeInAvailable flag.
 */
export async function getWalletBalances(): Promise<WalletBalancesResult> {
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

  const transactionsByWallet = groupByWalletId(walletTransactions);

  const accountsWithWallets: AccountWithWallets[] = accounts.map((acc) => {
    const wallets: WalletBalance[] = computeWalletBalancesForAccount(acc, transactionsByWallet).map(
      (w) => ({
        id: w.id,
        name: w.name,
        color: w.color,
        sortOrder: w.sortOrder,
        isSavings: w.isSavings,
        includeInAvailable: w.includeInAvailable,
        balance: w.balance,
      }),
    );

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
