import { ArrowDown, ArrowUp } from "lucide-react";
import {
  getTransactionList,
  type LedgerGroupBy,
  type LedgerFilters,
} from "@/lib/queries/transactions";
import { getCategories } from "@/lib/queries/expenses";
import { getWalletBalances } from "@/lib/queries/wallets";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
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

// ─── Balance summary (top of ledger) ───────────────────────────────────────
// Two layouts for the same three numbers: a compact single-card "hero" on
// mobile (balance headline + income/expenses as sub-stats — screen is too
// narrow for three side-by-side cards) and a three-card row on sm+.

function BalanceSummaryMobile({
  balance,
  income,
  expenses,
}: {
  balance: number;
  income: number;
  expenses: number;
}) {
  return (
    <div className="sm:hidden rounded-xl border border-border/60 bg-muted p-4 space-y-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
          Total Balance
        </p>
        <p
          className={cn(
            "font-mono text-2xl font-semibold tabular-nums",
            balance < 0 ? "text-destructive" : "text-foreground"
          )}
        >
          {formatCOP(balance)}
        </p>
      </div>
      <div className="flex items-center gap-5 border-t border-border/40 pt-3">
        <div className="flex items-center gap-1.5">
          <ArrowDown className="size-3.5 text-success shrink-0" />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Income</p>
            <p className="font-mono text-sm font-medium text-success">{formatCOP(income)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowUp className="size-3.5 text-destructive shrink-0" />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Expenses</p>
            <p className="font-mono text-sm font-medium text-destructive">{formatCOP(expenses)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BalanceSummaryDesktop({
  income,
  expenses,
  balance,
  hint,
}: {
  income: number;
  expenses: number;
  balance: number;
  hint?: string;
}) {
  return (
    <div className="hidden sm:grid grid-cols-3 gap-3">
      <StatCard label="Income" value={income} tone="good" hint={hint} surface="raised" />
      <StatCard label="Expenses" value={expenses} tone="bad" hint={hint} surface="raised" />
      <StatCard
        label="Total Balance"
        value={balance}
        tone={balance < 0 ? "bad" : "good"}
        hint={hint}
        surface="raised"
      />
    </div>
  );
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

  // Total Balance = the filtered wallet's current balance, or the
  // household-wide grand total (same includeInOverviewTotal-gated number the
  // Overview page shows) when no single wallet is selected.
  const selectedWalletBalance = filters.walletId
    ? walletBalances.accounts
        .flatMap((a) => a.wallets)
        .find((w) => w.id === filters.walletId)?.balance
    : undefined;
  const totalBalance = selectedWalletBalance ?? walletBalances.grandTotal;

  return (
    <div className="space-y-5">
      <BalanceSummaryMobile
        balance={totalBalance}
        income={result.monthTotalIncome}
        expenses={result.monthTotalExpense}
      />
      <BalanceSummaryDesktop
        income={result.monthTotalIncome}
        expenses={result.monthTotalExpense}
        balance={totalBalance}
        hint={walletHint}
      />

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
