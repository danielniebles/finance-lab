import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { getMonthlyAnalysis } from "@/lib/queries/expenses";
import { getFinancialPeriodBounds } from "@/lib/financial-period-utils";
import { periodProgress } from "@/lib/forecast-utils";
import { buildHomeInsights } from "@/lib/home-insights";
import { unpaidBills } from "@/lib/bill-display";
import { getBills } from "@/lib/queries/bills";
import type { WalletOption } from "@/components/shared/wallet-select";
import { CategoryBreakdownTable } from "@/components/expenses/category-breakdown-table";
import { AttentionCards } from "@/components/expenses/analysis/attention-cards";
import { GroupCard } from "@/components/expenses/analysis/group-card";
import { SavingsHero } from "@/components/expenses/analysis/savings-hero";

type GroupFilter = "FIXED" | "VARIABLE";

type Props = { month: number; year: number; walletId?: string; groupFilter?: GroupFilter; walletOptions: WalletOption[] };

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

type Analysis = Awaited<ReturnType<typeof getMonthlyAnalysis>>;
type Row = Analysis["categoryBreakdown"][number];

function filterByGroup(rows: Row[], groupFilter?: GroupFilter): Row[] {
  if (groupFilter === "FIXED") return rows.filter((c) => c.budgetType === "FIXED");
  if (groupFilter === "VARIABLE") return rows.filter((c) => c.budgetType !== "FIXED");
  return rows;
}

function periodDays(month: number, year: number) {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const { start, end } = getFinancialPeriodBounds(month, year, startDay);
  const progress = periodProgress(new Date(), start, end);
  return { daysElapsed: progress?.daysElapsed ?? null, daysInPeriod: progress?.daysInPeriod ?? null };
}

type UrlProps = { month: number; year: number; walletId?: string; groupFilter?: GroupFilter };

function GroupCards({ data, month, year, walletId, groupFilter }: UrlProps & { data: Analysis }) {
  const rows = data.categoryBreakdown;
  const unplannedNames = rows.filter((c) => c.severity === "Unplanned" && c.spent > 0).map((c) => c.name);
  const toggle = (g: GroupFilter) => buildAnalysisUrl(month, year, walletId, groupFilter === g ? undefined : g);
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <GroupCard
        title="Fixed · essential"
        actual={data.fixedActual}
        budget={data.fixedBudget}
        top={topBy(rows, (r) => r.budgetType === "FIXED")}
        href={toggle("FIXED")}
        active={groupFilter === "FIXED"}
      />
      <GroupCard
        title="Variable · discretionary"
        actual={data.variableActual}
        budget={data.variableBudget}
        top={topBy(rows, (r) => r.budgetType !== "FIXED")}
        unplanned={data.unplannedSpendTotal > 0 ? { total: data.unplannedSpendTotal, names: unplannedNames } : undefined}
        href={toggle("VARIABLE")}
        active={groupFilter === "VARIABLE"}
      />
    </section>
  );
}

function CategorySection({ rows, month, year, walletId, groupFilter }: UrlProps & { rows: Row[] }) {
  return (
    <div id="category-breakdown" className="flex scroll-mt-4 flex-col gap-2">
      {groupFilter && <GroupFilterChip groupFilter={groupFilter} clearHref={buildAnalysisUrl(month, year, walletId)} />}
      <CategoryBreakdownTable
        categoryBreakdown={filterByGroup(rows, groupFilter)}
        month={month}
        year={year}
        titleSuffix={groupFilter === "FIXED" ? "Fixed" : groupFilter === "VARIABLE" ? "Variable" : undefined}
      />
    </div>
  );
}

export async function AnalysisDashboard({ month, year, walletId, groupFilter, walletOptions }: Props) {
  const [data, bills] = await Promise.all([getMonthlyAnalysis(month, year, walletId), getBills(month, year)]);

  if (data.totalIncome === 0 && data.totalExpenses === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
        Nothing logged for this month yet. Add a transaction from the Ledger tab.
      </div>
    );
  }

  const rows = data.categoryBreakdown;
  // Pay bills is for the running month only; a past month's unpaid bill is history.
  const unpaid = bills.open ? unpaidBills(bills.bills) : [];

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
        pendingFixed={unpaid.reduce((s, b) => s + b.amount, 0)}
        {...periodDays(month, year)}
      />

      <AttentionCards insights={buildHomeInsights(rows, unpaid)} payBills={{ bills, walletOptions }} />

      <GroupCards data={data} month={month} year={year} walletId={walletId} groupFilter={groupFilter} />

      <CategorySection rows={rows} month={month} year={year} walletId={walletId} groupFilter={groupFilter} />

      <Link
        href={`/expenses?view=ledger&month=${month}&year=${year}`}
        className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
      >
        See every transaction in the Ledger <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
