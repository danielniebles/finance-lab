import { getTransactionList, type LedgerFilters } from "@/lib/queries/transactions";
import { getCategories } from "@/lib/queries/expenses";
import type { WalletBalancesResult } from "@/lib/queries/wallets";
import { getTags } from "@/lib/queries/tags";
import { getMonthlyAnalysis } from "@/lib/queries/expenses";
import { getFinancialPeriodBounds } from "@/lib/financial-period-utils";
import { periodProgress } from "@/lib/forecast-utils";
import type { ExpensesSearchParams } from "@/lib/build-expenses-url";
import type { WalletChipOption } from "@/lib/expenses-ledger-display";
import { LedgerSummary } from "@/components/expenses/ledger-summary";
import { LedgerControls } from "@/components/expenses/ledger-controls";
import { LedgerStickyBar } from "@/components/expenses/ledger-sticky-bar";
import { TransactionGroupList } from "@/components/expenses/transaction-group-list";
import { LedgerEmptyState } from "@/components/expenses/ledger-empty-state";
import { CategorySummaryPanel } from "@/components/expenses/category-summary-panel";

type Props = {
  month: number;
  year: number;
  filters: LedgerFilters;
  walletBalances: WalletBalancesResult;
  wallets: WalletChipOption[];
  walletActivity: Record<string, number>;
  currentParams: ExpensesSearchParams;
};

// Filters that narrow the list inside the wallet scope. filters.wallet (the
// legacy label field) is filtering-inert (see transactions.ts's
// matchesWallet) and walletId is the scope itself, so neither counts.
function hasAnyFilter(filters: LedgerFilters): boolean {
  return Boolean(filters.category || filters.type || filters.search || filters.tagId);
}

// Total Balance = the filtered wallet's current balance, or the
// household-wide grand total (same includeInOverviewTotal-gated number the
// Overview page shows) when no single wallet is selected.
function ledgerBalance(walletBalances: WalletBalancesResult, walletId: string | undefined): number {
  if (!walletId) return walletBalances.grandTotal;
  const wallet = walletBalances.accounts.flatMap((a) => a.wallets).find((w) => w.id === walletId);
  return wallet?.balance ?? walletBalances.grandTotal;
}

/** Day N of M when (month, year) is the period in progress, else null. */
function currentProgress(month: number, year: number) {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const { start, end } = getFinancialPeriodBounds(month, year, startDay);
  return periodProgress(new Date(), start, end);
}

function progressProps(p: ReturnType<typeof currentProgress>) {
  return { daysElapsed: p?.daysElapsed ?? null, daysInPeriod: p?.daysInPeriod ?? null };
}

const SUMMARY_ID = "ledger-summary";

// The Ledger tab's server entry point (rendered by expenses/page.tsx behind
// ?view=ledger), always grouped by day. Everything here is scoped by the
// wallet the page resolved (URL, else the remembered cookie); the month
// budget stays household-wide (getMonthlyAnalysis without a wallet).
export async function TransactionLedgerPage({
  month,
  year,
  filters,
  walletBalances,
  wallets,
  walletActivity,
  currentParams,
}: Props) {
  const [result, categories, tags, analysis] = await Promise.all([
    getTransactionList(month, year, "day", filters),
    getCategories(),
    getTags(),
    getMonthlyAnalysis(month, year),
  ]);
  const progress = currentProgress(month, year);

  const walletOptions = wallets.map(({ id, name }) => ({ id, name }));
  const walletName = wallets.find((w) => w.id === filters.walletId)?.name;
  const filtered = hasAnyFilter(filters);
  const balance = ledgerBalance(walletBalances, filters.walletId);

  return (
    <div className="space-y-5">
      <LedgerStickyBar
        summaryId={SUMMARY_ID}
        month={month}
        year={year}
        expenses={result.monthTotalExpense}
        net={result.monthTotalIncome - result.monthTotalExpense}
        balance={balance}
        wallets={wallets}
        walletActivity={walletActivity}
        selectedWalletId={filters.walletId}
        currentParams={currentParams}
      />

      <LedgerSummary
        id={SUMMARY_ID}
        walletName={walletName}
        income={result.monthTotalIncome}
        expenses={result.monthTotalExpense}
        balance={balance}
        budget={analysis.totalBudget}
        budgetSpent={analysis.totalExpenses}
        {...progressProps(progress)}
      />

      <CategorySummaryPanel
        rows={result.categorySummary}
        walletName={walletName}
        month={month}
        year={year}
        filters={filters}
      />

      <LedgerControls
        month={month}
        year={year}
        filters={filters}
        tags={tags}
        groups={result.groups}
        scopeCount={result.scopeCount}
        filtered={filtered}
      >
        {result.groups.length === 0 ? (
          <LedgerEmptyState hasActiveFilters={filtered} month={month} year={year} filters={filters} />
        ) : (
          <TransactionGroupList
            groups={result.groups}
            showWallet={!filters.walletId}
            categories={categories}
            walletOptions={walletOptions}
            tags={tags}
          />
        )}
      </LedgerControls>
    </div>
  );
}
