import {
  getTransactionList,
  type LedgerGroupBy,
  type LedgerFilters,
} from "@/lib/queries/transactions";
import { getCategories } from "@/lib/queries/expenses";
import { getWalletBalances } from "@/lib/queries/wallets";
import { StatCard } from "@/components/expenses/analysis-dashboard";
import { LedgerControls } from "@/components/expenses/ledger-controls";
import { AddTransactionRow } from "@/components/expenses/add-transaction-row";
import { TransactionGroupList } from "@/components/expenses/transaction-group-list";
import { LedgerEmptyState } from "@/components/expenses/ledger-empty-state";
import { CategorySummaryPanel } from "@/components/expenses/category-summary-panel";

type Props = {
  month: number;
  year: number;
  groupBy: LedgerGroupBy;
  filters: LedgerFilters;
};

function hasAnyFilter(filters: LedgerFilters): boolean {
  // filters.wallet (the legacy label field) is intentionally NOT checked here
  // — it's filtering-inert (see transactions.ts's matchesWallet, which only
  // compares walletId) and no longer written by ledger-controls.tsx, so
  // counting it would let a stale ?wallet= bookmark param report "active
  // filters" on an unfiltered result set.
  return Boolean(filters.category || filters.walletId || filters.type || filters.search);
}

// The Ledger tab's server entry point (rendered by expenses/page.tsx behind
// ?view=ledger). Fetches getTransactionList once for the CURRENT
// groupBy/filters (what's actually displayed) and getWalletBalances()
// separately to derive WalletSelect's full option list.
//
// NOTE (wallet-ledger-filter-fix, .scratch/wallet-ledger-filter-fix.md, 4th
// pass): walletOptions used to come from a month-scoped
// getTransactionList(month, year, "wallet") call, which only surfaced
// wallets with >= 1 transaction in the CURRENT month. AccountsCard links to a
// wallet by id regardless of monthly activity (it reads from
// getWalletBalances(), scoped to ALL wallets), so clicking a wallet with a
// real balance but zero transactions this month correctly filtered the
// ledger to an empty list, but WalletSelect's trigger fell back to "All
// wallets" — no option in the month-scoped list matched that id. Fixed by
// sourcing walletOptions from getWalletBalances() instead: every account's
// wallets, regardless of transaction activity. This also naturally excludes
// the "Sin asignar" pseudo-bucket (walletId: null) from the dropdown, since
// it isn't a real Wallet row — same exclusion behavior as before, no longer
// needing a sentinel-based filter to enforce it.
export async function TransactionLedgerPage({ month, year, groupBy, filters }: Props) {
  const [result, walletBalances, categories] = await Promise.all([
    getTransactionList(month, year, groupBy, filters),
    getWalletBalances(),
    getCategories(),
  ]);

  const walletOptions = walletBalances.accounts.flatMap((account) =>
    account.wallets.map((wallet) => ({ id: wallet.id, name: wallet.name })),
  );
  const activeFilters = hasAnyFilter(filters);
  const activeWalletName = walletOptions.find((w) => w.id === filters.walletId)?.name;
  const walletHint = activeWalletName ? `${activeWalletName} only` : undefined;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <StatCard label="Income" value={result.monthTotalIncome} tone="neutral" hint={walletHint} surface="raised" />
        <StatCard label="Expenses" value={result.monthTotalExpense} tone="neutral" hint={walletHint} surface="raised" />
      </div>

      <CategorySummaryPanel rows={result.categorySummary} />

      {/* Sibling of LedgerControls, not a child — must stay interactive
          during LedgerControls's filter-requery dimming (see
          .scratch/manual-transaction-entry.md). */}
      <AddTransactionRow categories={categories} walletOptions={walletOptions} />

      <LedgerControls
        month={month}
        year={year}
        groupBy={groupBy}
        filters={filters}
        categories={categories}
        walletOptions={walletOptions}
      >
        {result.groups.length === 0 ? (
          <LedgerEmptyState hasActiveFilters={activeFilters} month={month} year={year} />
        ) : (
          <TransactionGroupList groups={result.groups} groupBy={groupBy} categories={categories} />
        )}
      </LedgerControls>
    </div>
  );
}
