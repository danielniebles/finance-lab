import { db } from "@/lib/db";
import { computeWalletBalancesForAccount, groupByWalletId } from "@/lib/wallet-balance-utils";

export type AccountOption = {
  id: string;
  name: string;
  balance: number;
};

/**
 * Lightweight account list for picker UIs (e.g. the vault funding-source
 * picker). Balance is the account's full total — Σ ALL its wallets, same
 * grain `getWalletBalances()` reports per account (ADR-036/037) — since a
 * funding picker cares about the whole institution's money, not only its
 * savings-flagged partitions.
 */
export async function getSavingsAccounts(): Promise<AccountOption[]> {
  const [accounts, walletTransactions] = await Promise.all([
    db.savingsAccount.findMany({
      orderBy: { name: "asc" },
      include: {
        wallets: true,
        entries: true,
        transfersFrom: true,
        transfersTo: true,
        loansGiven: { include: { payments: true } },
        vaultEntriesFunded: true,
      },
    }),
    db.transaction.findMany({
      where: { walletId: { not: null } },
      select: { walletId: true, date: true, amount: true },
    }),
  ]);

  const transactionsByWallet = groupByWalletId(walletTransactions);

  return accounts.map((acc) => {
    const balance = computeWalletBalancesForAccount(acc, transactionsByWallet).reduce(
      (sum, w) => sum + w.balance,
      0,
    );
    return { id: acc.id, name: acc.name, balance };
  });
}
