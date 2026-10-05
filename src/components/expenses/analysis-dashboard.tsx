import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { getMonthlyAnalysis } from "@/lib/queries/expenses";
import { getFinancialPeriodBounds } from "@/lib/financial-period-utils";
import { periodProgress } from "@/lib/forecast-utils";
import { buildHomeInsights } from "@/lib/home-insights";
import { CategoryBreakdownTable } from "@/components/expenses/category-breakdown-table";
import { AttentionCards } from "@/components/expenses/analysis/attention-cards";
import { GroupCard } from "@/components/expenses/analysis/group-card";
import { SavingsHero } from "@/components/expenses/analysis/savings-hero";

type GroupFilter = "FIXED" | "VARIABLE";

type Props = { month: number; year: number; walletId?: string; groupFilter?: GroupFilter };

// Same-page filter (not a separate view) — clicking a Fixed/Variable card
// re-renders this server component with ?groupFilter=FIXED|VARIABLE, which
// narrows the category table. Preserves view=analysis + month/year/walletId.
function buildAnalysisUrl(month: number, year: number, walletId?: string, groupFilter?: GroupFilter): string {
  const params = new URLSearchParams({ view: "analysis", month: String(month), year: String(year) });
  if (walletId) params.set("walletId", walletId);
  if (groupFilter) params.set("groupFilter", groupFilter);
  return `/expenses?${params.toString()}#category-breakdown`;
}

function GroupFilterChip({ groupFilter, clearHref }: { groupFilter: GroupFilter; clearHref: string }) {
  const label = groupFilter === "FIXED" ? "Fixed expenses only" : "Variable expenses only";
  return (
    <div className="flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-1 pl-3 pr-1.5 text-xs font-medium text-primary">
      {label}
      <Link
        href={clearHref}
        aria-label="Clear filter"
        className="flex size-4.5 items-center justify-center rounded-full transition-colors hover:bg-primary/20"
      >
        <X className="size-3.5" />
      </Link>
    </div>
  );
}

function topBy<T extends { spent: number }>(rows: T[], pick: (r: T) => boolean): T[] {
  return rows.filter((r) => pick(r) && r.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 3);
}

export async function AnalysisDashboard({ month, year, walletId, groupFilter }: Props) {
  const data = await getMonthlyAnalysis(month, year, walletId);

  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const { start, end } = getFinancialPeriodBounds(month, year, startDay);
  const progress = periodProgress(new Date(), start, end);

  if (data.totalIncome === 0 && data.totalExpenses === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
        Nothing logged for this month yet. Add a transaction from the Ledger tab.
      </div>
    );
  }

  const rows = data.categoryBreakdown;
  const tableRows =
    groupFilter === "FIXED" ? rows.filter((c) => c.budgetType === "FIXED")
    : groupFilter === "VARIABLE" ? rows.filter((c) => c.budgetType !== "FIXED")
    : rows;
  const unplannedNames = rows.filter((c) => c.severity === "Unplanned" && c.spent > 0).map((c) => c.name);

  return (
    <div className="flex flex-col gap-6">
      {/* Legacy: only appears for historical MoneyLover rows whose category isn't mapped. */}
      {data.uncategorizedCount > 0 && (
        <div className="rounded-xl border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-warning">
          {data.uncategorizedCount} imported transaction(s) have unmapped categories and are excluded.{" "}
          <Link href="/settings/mappings" className="underline underline-offset-2">
            Legacy mappings
          </Link>
        </div>
      )}

      <SavingsHero
        savingsRate={data.savingsRate}
        realSavings={data.realSavings}
        totalIncome={data.totalIncome}
        totalExpenses={data.totalExpenses}
        totalBudget={data.totalBudget}
        pendingFixed={rows.filter((c) => c.severity === "Pending").reduce((s, c) => s + c.budget, 0)}
        daysElapsed={progress?.daysElapsed ?? null}
        daysInPeriod={progress?.daysInPeriod ?? null}
      />

      <AttentionCards insights={buildHomeInsights(rows)} />

      <section className="grid gap-4 lg:grid-cols-2">
        <GroupCard
          title="Fixed · essential"
          actual={data.fixedActual}
          budget={data.fixedBudget}
          top={topBy(rows, (r) => r.budgetType === "FIXED")}
          href={buildAnalysisUrl(month, year, walletId, groupFilter === "FIXED" ? undefined : "FIXED")}
          active={groupFilter === "FIXED"}
        />
        <GroupCard
          title="Variable · discretionary"
          actual={data.variableActual}
          budget={data.variableBudget}
          top={topBy(rows, (r) => r.budgetType !== "FIXED")}
          unplanned={data.unplannedSpendTotal > 0 ? { total: data.unplannedSpendTotal, names: unplannedNames } : undefined}
          href={buildAnalysisUrl(month, year, walletId, groupFilter === "VARIABLE" ? undefined : "VARIABLE")}
          active={groupFilter === "VARIABLE"}
        />
      </section>

      <div id="category-breakdown" className="flex scroll-mt-4 flex-col gap-2">
        {groupFilter && (
          <GroupFilterChip groupFilter={groupFilter} clearHref={buildAnalysisUrl(month, year, walletId)} />
        )}
        <CategoryBreakdownTable
          categoryBreakdown={tableRows}
          month={month}
          year={year}
          titleSuffix={groupFilter === "FIXED" ? "Fixed" : groupFilter === "VARIABLE" ? "Variable" : undefined}
        />
      </div>

      <Link
        href={`/expenses?view=ledger&month=${month}&year=${year}`}
        className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
      >
        See every transaction in the Ledger <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
