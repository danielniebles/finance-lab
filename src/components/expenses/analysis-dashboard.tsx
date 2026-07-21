import Link from "next/link";
import { getMonthlyAnalysis } from "@/lib/queries/expenses";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, X } from "lucide-react";
import { resolveEffectiveCategoryStyle } from "@/lib/category-style";
import { CategoryBreakdownTable, SeverityBadge } from "@/components/expenses/category-breakdown-table";
import { BudgetProgressBar } from "@/components/expenses/budget-progress-bar";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

type GroupFilter = "FIXED" | "VARIABLE";

type Props = { month: number; year: number; walletId?: string; groupFilter?: GroupFilter };

export async function AnalysisDashboard({ month, year, walletId, groupFilter }: Props) {
  const data = await getMonthlyAnalysis(month, year, walletId);

  if (data.totalIncome === 0 && data.totalExpenses === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
        No data for this period. Import a MoneyLover export to get started.
      </div>
    );
  }

  const fixedControl = data.fixedBudget - data.fixedActual;
  const variableControl = data.variableBudget - data.variableActual;
  const fixedPercentUsed = data.fixedBudget > 0 ? (data.fixedActual / data.fixedBudget) * 100 : null;
  const variablePercentUsed = data.variableBudget > 0 ? (data.variableActual / data.variableBudget) * 100 : null;
  const burnRateAlert = data.variableBurnRate !== null && data.variableBurnRate > 100;

  const topFixedCategories = [...data.categoryBreakdown]
    .filter((c) => c.budgetType === "FIXED" && c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 3);
  const topVariableCategories = [...data.categoryBreakdown]
    .filter((c) => c.budgetType !== "FIXED" && c.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 3);

  const tableRows =
    groupFilter === "FIXED" ? data.categoryBreakdown.filter((c) => c.budgetType === "FIXED")
    : groupFilter === "VARIABLE" ? data.categoryBreakdown.filter((c) => c.budgetType !== "FIXED")
    : data.categoryBreakdown;

  return (
    <div className="space-y-5">
      {/* Unmapped warning */}
      {data.uncategorizedCount > 0 && (
        <div className="rounded-lg border border-warning/20 bg-warning/8 px-4 py-3 text-sm text-warning">
          {data.uncategorizedCount} transaction(s) have unmapped categories and are excluded.{" "}
          <a href="/settings/mappings" className="underline underline-offset-2 hover:text-warning/70">
            Configure mappings →
          </a>
        </div>
      )}

      {/* ── Top offenders ──────────────────────────────────────────────── */}
      {data.topOffenders.length > 0 && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-5 text-destructive" />
            <h3 className="text-sm font-semibold text-destructive">Top Issues</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {data.topOffenders.map((cat) => (
              <div
                key={cat.id}
                className="flex items-start justify-between rounded-lg border border-border/40 bg-card px-3 py-2.5 gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{cat.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatCOP(cat.spent)}
                    {cat.budget > 0 && (
                      <span className="text-muted-foreground/60"> of {formatCOP(cat.budget)}</span>
                    )}
                  </p>
                  {cat.percentUsed !== null && (
                    <BudgetProgressBar percent={cat.percentUsed} className="mt-1.5" />
                  )}
                </div>
                <SeverityBadge severity={cat.severity} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Top stat strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Monthly Income" value={data.totalIncome} tone="neutral" />
        <StatCard label="Total Expenses" value={data.totalExpenses} tone="neutral" />
        <StatCard label="Total Budget" value={data.totalBudget} tone="neutral" />
        <StatCard
          label="Over / Under Budget"
          value={-data.overexpense}
          tone={data.overexpense > 0 ? "bad" : "good"}
          showTrend
        />
        <StatCard
          label="Savings Rate"
          rawValue={data.savingsRate !== null ? `${data.savingsRate.toFixed(1)}%` : "—"}
          tone={
            data.savingsRate === null ? "neutral"
            : data.savingsRate >= 20 ? "good"
            : data.savingsRate >= 10 ? "neutral"
            : "bad"
          }
          hint={data.savingsRate !== null && data.savingsRate < 20 ? "Target: 20%" : undefined}
        />
      </div>

      {/* ── Fixed · Variable · Savings ─────────────────────────────────── */}
      {(() => {
        const budgetCards = [
          {
            key: "fixed",
            node: (
              <BudgetGroupCard
                title="Fixed Expenses"
                pillLabel="ESSENTIAL"
                percentUsed={fixedPercentUsed}
                actual={data.fixedActual}
                budget={data.fixedBudget}
                control={fixedControl}
                controlLabel="Efficiency"
                topCategoriesLabel="Priority outlays"
                topCategories={topFixedCategories}
                filterHref={buildAnalysisUrl(month, year, walletId, "FIXED")}
                clearHref={buildAnalysisUrl(month, year, walletId)}
                isActiveFilter={groupFilter === "FIXED"}
              />
            ),
          },
          {
            key: "variable",
            node: (
              <BudgetGroupCard
                title="Variable Expenses"
                pillLabel="DISCRETIONARY"
                percentUsed={variablePercentUsed}
                actual={data.variableActual}
                budget={data.variableBudget}
                control={variableControl}
                controlLabel="Burn rate"
                topCategoriesLabel="Top variances"
                topCategories={topVariableCategories}
                filterHref={buildAnalysisUrl(month, year, walletId, "VARIABLE")}
                clearHref={buildAnalysisUrl(month, year, walletId)}
                isActiveFilter={groupFilter === "VARIABLE"}
                extraBadge={
                  burnRateAlert ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                      <AlertTriangle className="size-3.5" />
                      {data.variableBurnRate!.toFixed(0)}%
                    </span>
                  ) : undefined
                }
              />
            ),
          },
          { key: "savings", node: <SavingsCard data={data} /> },
        ];

        return (
          <>
            {/* Mobile/tablet: carousel — this row only becomes a 3-column
                grid at lg, so it's stacked (and long) below that today. */}
            <Carousel opts={{ align: "start" }} className="lg:hidden">
              <CarouselContent>
                {budgetCards.map((card) => (
                  <CarouselItem key={card.key} className="basis-[88%]">
                    {card.node}
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>

            <div className="hidden gap-3 lg:grid lg:grid-cols-3">
              {budgetCards.map((card) => (
                <div key={card.key}>{card.node}</div>
              ))}
            </div>
          </>
        );
      })()}

      {/* ── Category breakdown table ───────────────────────────────────── */}
      <div id="category-breakdown" className="space-y-2 scroll-mt-4">
        {groupFilter && (
          <GroupFilterChip
            groupFilter={groupFilter}
            clearHref={buildAnalysisUrl(month, year, walletId)}
          />
        )}
        <CategoryBreakdownTable
          categoryBreakdown={tableRows}
          month={month}
          year={year}
          titleSuffix={groupFilter === "FIXED" ? "Fixed" : groupFilter === "VARIABLE" ? "Variable" : undefined}
        />
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

// Same-page filter (not a separate view) — clicking a Fixed/Variable card
// re-renders this server component with ?groupFilter=FIXED|VARIABLE, which
// narrows `tableRows` before it reaches CategoryBreakdownTable. Preserves
// view=analysis + month/year/walletId so the rest of the page is unaffected.
function buildAnalysisUrl(month: number, year: number, walletId?: string, groupFilter?: GroupFilter): string {
  const params = new URLSearchParams({ view: "analysis", month: String(month), year: String(year) });
  if (walletId) params.set("walletId", walletId);
  if (groupFilter) params.set("groupFilter", groupFilter);
  return `/expenses?${params.toString()}#category-breakdown`;
}

function GroupFilterChip({ groupFilter, clearHref }: { groupFilter: GroupFilter; clearHref: string }) {
  const label = groupFilter === "FIXED" ? "Fixed expenses only" : "Variable expenses only";
  return (
    <div className="flex items-center gap-1.5 w-fit rounded-full border border-primary/30 bg-primary/10 py-1 pl-3 pr-1.5 text-xs font-medium text-primary">
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

type TopCategory = { id: string; name: string; spent: number; icon: string | null; color: string | null };

function SavingsCard({ data }: { data: Awaited<ReturnType<typeof getMonthlyAnalysis>> }) {
  return (
    <div className="h-full rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold tracking-wide text-success">
          SAVINGS
        </span>
        {data.savingsRate !== null && (
          <span className={cn(
            "font-mono text-lg font-semibold",
            data.savingsRate >= 20 ? "text-success" : data.savingsRate >= 10 ? "text-foreground" : "text-destructive"
          )}>
            {data.savingsRate.toFixed(1)}%
            <span className="ml-1 text-xs font-normal text-muted-foreground"> saved</span>
          </span>
        )}
      </div>
      <div className="space-y-2">
        <PillRow
          label="Actual (Salary − Spend)"
          value={data.realSavings}
          highlight={data.realSavings >= 0 ? "good" : "bad"}
          prominent
        />
        <PillRow
          label="Target (Salary − Budget)"
          value={data.idealSavings}
          highlight={data.idealSavings >= 0 ? "good" : "bad"}
        />
        <div className="mt-1 border-t border-border/40 pt-2">
          <PillRow
            label="Gap (Actual − Target)"
            rawValue={`${data.savingsGap >= 0 ? "+" : ""}${formatCOP(data.savingsGap)}`}
            highlight={data.savingsGap >= 0 ? "good" : "bad"}
          />
          {data.unplannedSpendTotal > 0 && (
            <PillRow
              label="Unplanned spend"
              value={data.unplannedSpendTotal}
              highlight="bad"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function BudgetGroupCard({
  title,
  pillLabel,
  percentUsed,
  actual,
  budget,
  control,
  controlLabel,
  topCategoriesLabel,
  topCategories,
  filterHref,
  clearHref,
  isActiveFilter,
  extraBadge,
}: {
  title: string;
  pillLabel: string;
  percentUsed: number | null;
  actual: number;
  budget: number;
  control: number;
  controlLabel: string;
  topCategoriesLabel: string;
  topCategories: TopCategory[];
  filterHref: string;
  clearHref: string;
  isActiveFilter: boolean;
  extraBadge?: React.ReactNode;
}) {
  const isUnder = control >= 0;
  const isOverBudget = (percentUsed ?? 0) > 100;

  return (
    <Link
      href={isActiveFilter ? clearHref : filterHref}
      className={cn(
        "block h-full rounded-xl border p-4 space-y-4 transition-colors cursor-pointer",
        isActiveFilter
          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
          : "border-border/60 bg-card hover:border-border hover:bg-muted/30"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        <div className="flex items-center gap-1.5">
          {extraBadge}
          <span className="inline-flex items-center rounded-full border border-border/60 bg-muted px-2.5 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground">
            {pillLabel}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <CircularProgress
          percent={percentUsed ?? 0}
          colorClass={isOverBudget ? "stroke-destructive" : "stroke-primary"}
        />
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Actual spending
            </p>
            <p className="font-mono text-lg font-semibold tabular-nums">{formatCOP(actual)}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Budget</span>
            <span className="font-mono text-sm tabular-nums text-muted-foreground">{formatCOP(budget)}</span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {controlLabel}
            </span>
            <span
              className={cn(
                "font-mono text-sm font-semibold tabular-nums",
                isUnder ? "text-success" : "text-destructive"
              )}
            >
              {isUnder ? "+" : "-"}
              {formatCOP(Math.abs(control))} {isUnder ? "Under" : "Overage"}
            </span>
          </div>
        </div>
      </div>

      {topCategories.length > 0 && (
        <div className="space-y-1.5 border-t border-border/40 pt-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {topCategoriesLabel}
          </p>
          {topCategories.map((cat) => {
            const { icon: CategoryIcon, iconWrap } = resolveEffectiveCategoryStyle(
              cat.name, cat.icon, cat.color
            );
            return (
              <div
                key={cat.id}
                className="flex items-center gap-2.5 rounded-lg border border-border/40 px-2.5 py-2"
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", iconWrap)}>
                  <CategoryIcon className="size-5" />
                </span>
                <span className="text-sm truncate flex-1 min-w-0">{cat.name}</span>
                <span className="font-mono text-sm tabular-nums shrink-0">{formatCOP(cat.spent)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Link>
  );
}

function CircularProgress({
  percent,
  colorClass,
  size = 88,
  strokeWidth = 8,
}: {
  percent: number;
  colorClass: string;
  size?: number;
  strokeWidth?: number;
}) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const displayPercent = Math.round(Math.max(0, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          strokeWidth={strokeWidth} fill="none"
          className="stroke-muted/40"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("transition-all", colorClass)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-base font-bold tabular-nums">{displayPercent}%</span>
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Used</span>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  rawValue,
  tone,
  showTrend,
  hint,
  surface = "card",
}: {
  label: string;
  value?: number;
  rawValue?: string;
  tone: "good" | "bad" | "neutral";
  showTrend?: boolean;
  hint?: string;
  surface?: "card" | "raised";
}) {
  const valueColor =
    tone === "good" ? "text-success" :
    tone === "bad" ? "text-destructive" :
    "text-foreground";

  const TrendIcon =
    tone === "good" ? TrendingUp :
    tone === "bad" ? TrendingDown :
    Minus;

  const display = rawValue ?? (value !== undefined ? formatCOP(Math.abs(value)) : "—");

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 px-4 py-4",
        surface === "raised" ? "bg-muted" : "bg-card"
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
        {label}
      </p>
      <div className="flex items-end justify-between gap-2">
        <p className={cn("font-mono text-lg font-semibold tabular-nums leading-tight", valueColor)}>
          {display}
        </p>
        {showTrend && (
          <TrendIcon className={cn("size-5 shrink-0 mb-0.5", valueColor)} />
        )}
      </div>
      {hint && (
        <p className="text-xs text-muted-foreground/60 mt-1">{hint}</p>
      )}
    </div>
  );
}

function PillRow({
  label,
  value,
  rawValue,
  highlight,
  prominent,
}: {
  label: string;
  value?: number;
  rawValue?: string;
  highlight?: "good" | "bad";
  prominent?: boolean;
}) {
  const displayValue = rawValue ?? (value !== undefined ? formatCOP(value) : "—");
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          prominent ? "text-sm font-semibold" : "text-xs font-medium",
          highlight === "good" && "text-success",
          highlight === "bad" && "text-destructive",
          !highlight && "text-foreground"
        )}
      >
        {displayValue}
      </span>
    </div>
  );
}

