import { db } from "@/lib/db";
import { computeWalletBalancesForAccount, groupByWalletId, type DatedFlow } from "@/lib/wallet-balance-utils";

export type AccountWithBalance = {
  id: string;
  name: string;
  accountType: "BANK" | "DIGITAL" | "PENSION";
  color: string | null;
  /**
   * Display convenience derived from this account's savingsWalletId wallet
   * (ADR-036 moved the real flag down to Wallet, which can have DIFFERENT
   * flags per partition — e.g. Bancolombia's investments wallet is excluded
   * while its savings wallet isn't). Kept here so existing account-level UI
   * (AccountCard's "excluded" badge, the account form's checkbox) keeps
   * compiling unchanged; a true per-wallet breakdown is the Frontend
   * follow-up (HANDOFF §4) on top of getWalletBalances().
   */
  includeInAvailable: boolean;
  // Gates membership in the Overview "Total balance" grand total — a
  // separate concern from includeInAvailable's liquidity gating.
  includeInOverviewTotal: boolean;
  balance: number;
  loansOut: number;
  entries: { id: string; type: "INITIAL" | "ADJUSTMENT"; amount: number; date: Date; notes: string | null }[];
  vaultEntries: {
    id: string;
    amount: number;
    date: Date;
    notes: string | null;
    vaultName: string;
  }[];
};

export type LoanWithRemaining = {
  id: string;
  debtorId: string;
  accountId: string;
  accountName: string;
  accountColor: string | null;
  amount: number;
  date: Date;
  expectedBy: Date | null;
  notes: string | null;
  createdAt: Date;
  paid: number;
  remaining: number;
  isActive: boolean;
  payments: { id: string; amount: number; date: Date; notes: string | null }[];
};

export type DebtorWithLoans = {
  id: string;
  name: string;
  notes: string | null;
  loans: LoanWithRemaining[];
  totalOwed: number;
  activeLoansCount: number;
};

export type LoansOverview = {
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  available: number;
  inLoans: number;
  totalSavings: number;
  liquidityRatio: number | null;
  totalEverLent: number;
  totalRecovered: number;
  inVaults: number;         // sourced vault money (separate from totalSavings)
  netWorth: number;         // totalSavings + inVaults (informational)
};

/** Per-wallet rollup used both to build the accounts[] array and the flat KPIs below. */
type WalletRollup = {
  id: string;
  isSavings: boolean;
  includeInAvailable: boolean;
  balance: number;
};

function fetchAccountsForOverview() {
  return db.savingsAccount.findMany({
    include: {
      wallets: { orderBy: { sortOrder: "asc" } },
      entries: { orderBy: { date: "asc" } },
      loansGiven: {
        include: { payments: { orderBy: { date: "asc" } } },
        orderBy: { date: "asc" },
      },
      transfersFrom: true,
      transfersTo: true,
      vaultEntriesFunded: {
        include: { vault: { select: { name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });
}

function fetchDebtorsForOverview() {
  return db.debtor.findMany({
    include: {
      loans: {
        include: {
          payments: { orderBy: { date: "asc" } },
          account: { select: { name: true, color: true } },
        },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

type OverviewAccount = Awaited<ReturnType<typeof fetchAccountsForOverview>>[number];
type OverviewDebtor = Awaited<ReturnType<typeof fetchDebtorsForOverview>>[number];

/**
 * Per-wallet balances (ADR-036/037) — the same rows getWalletBalances()
 * sums, so the Loans savings figure and Home's grand total can never drift
 * apart (they're one computation, not two hand-synced systems).
 */
function buildWalletRollups(
  accounts: OverviewAccount[],
  transactionsByWallet: Map<string, DatedFlow[]>,
): { byAccount: Map<string, WalletRollup[]>; all: WalletRollup[] } {
  const byAccount = new Map<string, WalletRollup[]>();
  const all: WalletRollup[] = [];
  for (const acc of accounts) {
    const rollups: WalletRollup[] = computeWalletBalancesForAccount(acc, transactionsByWallet).map(
      (w) => ({ id: w.id, isSavings: w.isSavings, includeInAvailable: w.includeInAvailable, balance: w.balance }),
    );
    byAccount.set(acc.id, rollups);
    all.push(...rollups);
  }
  return { byAccount, all };
}

/**
 * Derives account balances from the savings-flagged wallets only — the
 * Loans surface shows the savings partition, not the whole account (e.g.
 * Bancolombia's debit/daily spending wallet is excluded — HANDOFF).
 */
function buildAccountsWithBalance(
  accounts: OverviewAccount[],
  walletRollupsByAccount: Map<string, WalletRollup[]>,
): AccountWithBalance[] {
  return accounts.map((acc) => {
    const rollups = walletRollupsByAccount.get(acc.id) ?? [];
    const balance = rollups.filter((w) => w.isSavings).reduce((s, w) => s + w.balance, 0);
    const savingsWalletRollup = rollups.find((w) => w.id === acc.savingsWalletId);
    const loansOut = acc.loansGiven.reduce((s, l) => {
      const paid = l.payments.reduce((sp, p) => sp + p.amount, 0);
      return s + Math.max(0, l.amount - paid);
    }, 0);
    return {
      id: acc.id,
      name: acc.name,
      accountType: acc.accountType as "BANK" | "DIGITAL" | "PENSION",
      color: acc.color,
      includeInAvailable: savingsWalletRollup?.includeInAvailable ?? true,
      includeInOverviewTotal: acc.includeInOverviewTotal ?? true,
      balance,
      loansOut,
      entries: acc.entries,
      vaultEntries: acc.vaultEntriesFunded.map((e) => ({
        id: e.id,
        amount: e.amount,
        date: e.date,
        notes: e.notes,
        vaultName: e.vault.name,
      })),
    };
  });
}

/** Derives loan remaining balances and debtor totals; sorted biggest exposure first. */
function buildDebtorsWithLoans(debtors: OverviewDebtor[]): DebtorWithLoans[] {
  const debtorsWithLoans: DebtorWithLoans[] = debtors.map((d) => {
    const loans: LoanWithRemaining[] = d.loans.map((l) => {
      const paid = l.payments.reduce((s, p) => s + p.amount, 0);
      const remaining = Math.max(0, l.amount - paid);
      return {
        id: l.id,
        debtorId: l.debtorId,
        accountId: l.accountId,
        accountName: l.account.name,
        accountColor: l.account.color,
        amount: l.amount,
        date: l.date,
        expectedBy: l.expectedBy,
        notes: l.notes,
        createdAt: l.createdAt,
        paid,
        remaining,
        isActive: remaining > 0,
        payments: l.payments,
      };
    });
    const totalOwed = loans.reduce((s, l) => s + l.remaining, 0);
    const activeLoansCount = loans.filter((l) => l.isActive).length;
    return { id: d.id, name: d.name, notes: d.notes, loans, totalOwed, activeLoansCount };
  });
  debtorsWithLoans.sort((a, b) => b.totalOwed - a.totalOwed);
  return debtorsWithLoans;
}

export async function getLoansOverview(): Promise<LoansOverview> {
  const [accounts, debtors, walletTransactions] = await Promise.all([
    fetchAccountsForOverview(),
    fetchDebtorsForOverview(),
    db.transaction.findMany({
      where: { walletId: { not: null } },
      select: { walletId: true, date: true, amount: true },
    }),
  ]);

  const transactionsByWallet = groupByWalletId(walletTransactions);
  const { byAccount: walletRollupsByAccount, all: allWalletRollups } = buildWalletRollups(
    accounts,
    transactionsByWallet,
  );
  const accountsWithBalance = buildAccountsWithBalance(accounts, walletRollupsByAccount);
  const debtorsWithLoans = buildDebtorsWithLoans(debtors);

  // KPIs — `available` is computed directly over ALL wallets (not
  // accounts[].balance, which rolls up per account and can't express a
  // mixed includeInAvailable across an account's own partitions, e.g.
  // Bancolombia's savings=true vs investments=false).
  const available = allWalletRollups
    .filter((w) => w.isSavings && w.includeInAvailable)
    .reduce((s, w) => s + w.balance, 0);

  const inLoans = debtorsWithLoans.reduce((s, d) => s + d.totalOwed, 0);
  const totalSavings = available + inLoans;
  const liquidityRatio = totalSavings > 0 ? (available / totalSavings) * 100 : null;

  const totalEverLent = debtorsWithLoans.reduce(
    (s, d) => s + d.loans.reduce((ls, l) => ls + l.amount, 0),
    0,
  );
  const totalRecovered = debtorsWithLoans.reduce(
    (s, d) => s + d.loans.reduce((ls, l) => ls + l.paid, 0),
    0,
  );

  // Sourced vault money across all accounts (contributions positive, withdrawals negative)
  const inVaults = accounts.reduce(
    (s, acc) => s + acc.vaultEntriesFunded.reduce((as, e) => as + e.amount, 0),
    0,
  );

  return { accounts: accountsWithBalance, debtors: debtorsWithLoans, available, inLoans, totalSavings, liquidityRatio, totalEverLent, totalRecovered, inVaults, netWorth: totalSavings + inVaults };
}
