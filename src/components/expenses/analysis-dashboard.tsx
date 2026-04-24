import { getMonthlyAnalysis, type CategorySeverity } from "@/lib/queries/expenses";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { CategoryBreakdownTable } from "@/components/expenses/category-breakdown-table";

type Props = { month: number; year: number };

export async function AnalysisDashboard({ month, year }: Props) {
  const data = await getMonthlyAnalysis(month, year);

  if (data.totalIncome === 0 && data.totalExpenses === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
        No data for this period. Import a MoneyLover export to get started.
      </div>
    );
  }

  const fixedControl = data.fixedBudget - data.fixedActual;
  const variableControl = data.variableBudget - data.variableActual;
  const burnRateAlert = data.variableBurnRate !== null && data.variableBurnRate > 100;

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
            <AlertTriangle className="size-4 text-destructive" />
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
                    <ProgressBar percent={cat.percentUsed} className="mt-1.5" />
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

      {/* ── Fixed · Variable pills + Savings ──────────────────────────── */}
      <div className="grid gap-3 lg:grid-cols-3">

        {/* Fixed pill */}
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-blue-600 dark:text-blue-400">
              FIXED
            </span>
          </div>
          <div className="space-y-2">
            <PillRow label="Actual" value={data.fixedActual} />
            <PillRow label="Budget" value={data.fixedBudget} />
            <div className="mt-1 border-t border-border/40 pt-2">
              <PillRow
                label="Control (Budget − Actual)"
                prominent
                value={fixedControl}
                highlight={fixedControl >= 0 ? "good" : "bad"}
              />
            </div>
            <div className="mt-1 border-t border-border/40 pt-2">
              <VarianceRows variance={data.fixedVariance} />
            </div>
          </div>
        </div>

        {/* Variable pill */}
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-violet-600 dark:text-violet-400">
              VARIABLE
            </span>
            {burnRateAlert && (
              <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                <AlertTriangle className="size-3" />
                {data.variableBurnRate!.toFixed(0)}% burn rate
              </span>
            )}
          </div>
          <div className="space-y-2">
            <PillRow label="Actual" value={data.variableActual} />
            <PillRow label="Budget" value={data.variableBudget} />
            <div className="mt-1 border-t border-border/40 pt-2">
              <PillRow
                label="Control (Budget − Actual)"
                prominent
                value={variableControl}
                highlight={variableControl >= 0 ? "good" : "bad"}
              />
              {data.variableBurnRate !== null && !burnRateAlert && (
                <PillRow
                  label="Burn Rate"
                  rawValue={`${data.variableBurnRate.toFixed(1)}%`}
                  highlight="good"
                />
              )}
            </div>
            <div className="mt-1 border-t border-border/40 pt-2">
              <VarianceRows variance={data.variableVariance} />
            </div>
          </div>
        </div>

        {/* Savings */}
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
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
      </div>

      {/* ── Category breakdown table ───────────────────────────────────── */}
      <CategoryBreakdownTable
        categoryBreakdown={data.categoryBreakdown}
        month={month}
        year={year}
      />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  rawValue,
  tone,
  showTrend,
  hint,
}: {
  label: string;
  value?: number;
  rawValue?: string;
  tone: "good" | "bad" | "neutral";
  showTrend?: boolean;
  hint?: string;
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
    <div className="rounded-xl border border-border/60 bg-card px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
        {label}
      </p>
      <div className="flex items-end justify-between gap-2">
        <p className={cn("font-mono text-lg font-semibold tabular-nums leading-tight", valueColor)}>
          {display}
        </p>
        {showTrend && (
          <TrendIcon className={cn("size-4 shrink-0 mb-0.5", valueColor)} />
        )}
      </div>
      {hint && (
        <p className="text-xs text-muted-foreground/60 mt-1">{hint}</p>
      )}
    </div>
  );
}

type VarianceCat = { name: string; control: number };

type Variance = {
  surplusCount: number;
  surplusTotal: number;
  surplusCategories: VarianceCat[];
  deficitCount: number;
  deficitTotal: number;
  deficitCategories: VarianceCat[];
  offsetCoverage: number | null;
};

function VarianceRows({ variance: v }: { variance: Variance }) {
  const covered = v.offsetCoverage !== null && v.offsetCoverage >= 100;
  return (
    <div className="space-y-1.5">
      {v.surplusCount > 0 && (
        <>
          <PillRow
            label={`Under budget (${v.surplusCount} cat${v.surplusCount !== 1 ? "s" : ""})`}
            rawValue={`+${formatCOP(v.surplusTotal)}`}
            highlight="good"
          />
          <div className="pl-2 space-y-0.5">
            {v.surplusCategories.map((c) => (
              <div key={c.name} className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground truncate">{c.name}</span>
                <span className="font-mono text-xs tabular-nums text-success/70 shrink-0">
                  +{formatCOP(c.control)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {v.deficitCount > 0 && (
        <>
          <PillRow
            label={`Over budget (${v.deficitCount} cat${v.deficitCount !== 1 ? "s" : ""})`}
            rawValue={v.deficitTotal > 0 ? `-${formatCOP(v.deficitTotal)}` : formatCOP(0)}
            highlight={v.deficitTotal > 0 ? "bad" : "good"}
          />
          <div className="pl-2 space-y-0.5">
            {v.deficitCategories.map((c) => (
              <div key={c.name} className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground truncate">{c.name}</span>
                <span className="font-mono text-xs tabular-nums text-destructive/70 shrink-0">
                  -{formatCOP(Math.abs(c.control))}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {v.offsetCoverage !== null && v.deficitTotal > 0 && (
        <PillRow
          label="Overspend covered by savings"
          rawValue={`${v.offsetCoverage.toFixed(0)}%`}
          highlight={covered ? "good" : "bad"}
        />
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

function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  const clamped = Math.min(percent, 100);
  const barColor =
    percent >= 100 ? "bg-destructive" :
    percent >= 80  ? "bg-warning" :
    "bg-success";

  return (
    <div className={cn("h-1.5 w-full rounded-full bg-muted/50", className)}>
      <div
        className={cn("h-1.5 rounded-full transition-all", barColor)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function SeverityBadge({ severity }: { severity: CategorySeverity }) {
  const styles: Record<CategorySeverity, string> = {
    OK:        "border-success/25 bg-success/10 text-success",
    Issue:     "border-warning/25 bg-warning/10 text-warning",
    Critical:  "border-destructive/25 bg-destructive/10 text-destructive",
    Unplanned: "border-warning/25 bg-warning/10 text-warning",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", styles[severity])}>
      {severity}
    </span>
  );
}
