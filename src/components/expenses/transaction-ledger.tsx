import {
  getTransactionList,
  type LedgerGroupBy,
  type LedgerFilters,
  type CategorySummaryRow,
} from "@/lib/queries/transactions";
import { getCategories } from "@/lib/queries/expenses";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/expenses/analysis-dashboard";
import { LedgerControls } from "@/components/expenses/ledger-controls";
import { TransactionGroupList } from "@/components/expenses/transaction-group-list";
import { LedgerEmptyState } from "@/components/expenses/ledger-empty-state";

type Props = {
  month: number;
  year: number;
  groupBy: LedgerGroupBy;
  filters: LedgerFilters;
};

function hasAnyFilter(filters: LedgerFilters): boolean {
  return Boolean(filters.category || filters.wallet || filters.type || filters.search);
}

// The Ledger tab's server entry point (rendered by expenses/page.tsx behind
// ?view=ledger). Fetches getTransactionList twice: once for the CURRENT
// groupBy/filters (what's actually displayed) and once ungrouped-by-wallet
// with NO filters, purely to derive the full month's distinct wallet labels
// for WalletSelect's option list — using the existing typed API rather than
// inventing a new query, so the select's options don't collapse to "whatever
// the current filter already narrowed to."
export async function TransactionLedgerPage({ month, year, groupBy, filters }: Props) {
  const [result, walletUniverse, categories] = await Promise.all([
    getTransactionList(month, year, groupBy, filters),
    getTransactionList(month, year, "wallet"),
    getCategories(),
  ]);

  const walletOptions = walletUniverse.groups.map((g) => g.label);
  const activeFilters = hasAnyFilter(filters);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <StatCard label="Income" value={result.monthTotalIncome} tone="neutral" />
        <StatCard label="Expenses" value={result.monthTotalExpense} tone="neutral" />
      </div>

      <CategorySummaryPanel rows={result.categorySummary} />

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

// Informational only — clicking a row here does NOT filter the list below
// (CategorySelect already owns that action; a second hidden trigger for the
// same re-query would be a duplicate control, per the design spec).
function CategorySummaryPanel({ rows }: { rows: CategorySummaryRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Categories
      </p>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center justify-between gap-2">
            <span className="text-sm truncate">{row.name}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {row.count} txn{row.count !== 1 ? "s" : ""}
              </span>
              <span
                className={cn(
                  "font-mono text-sm tabular-nums",
                  row.total < 0 ? "text-destructive" : "text-success"
                )}
              >
                {row.total < 0 ? "-" : ""}
                {formatCOP(Math.abs(row.total))}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
