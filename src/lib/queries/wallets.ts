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
  balance: number; // Σ this account's wallets
  wallets: WalletBalance[];
};

export type WalletBalancesResult = {
  accounts: AccountWithWallets[];
  grandTotal: number; // Σ ALL wallet.balance — the real bank balance (Home number)
};

/**
 * Per-wallet balances + a grand total across every institution (ADR-036/037,
 * HANDOFF §3). This is the Home/Overview number — every partition included,
 * grand total = the actual bank balance. Contrast with `getLoansOverview`
 * (`queries/loans.ts`), which reports only the `isSavings` subset.
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
      balance: wallets.reduce((sum, w) => sum + w.balance, 0),
      wallets,
    };
  });

  const grandTotal = accountsWithWallets.reduce((sum, a) => sum + a.balance, 0);

  return { accounts: accountsWithWallets, grandTotal };
}
