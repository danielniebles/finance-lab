import { getMonthlyAnalysis, type CategorySeverity } from "@/lib/queries/expenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

type Props = { month: number; year: number };

export async function AnalysisDashboard({ month, year }: Props) {
  const data = await getMonthlyAnalysis(month, year);

  const fixedControl = data.fixedBudget - data.fixedActual;
  const variableControl = data.variableBudget - data.variableActual;
  const burnRateAlert = data.variableBurnRate !== null && data.variableBurnRate > 100;

  return (
    <div className="space-y-5">
      {/* Unmapped warning */}
      {data.uncategorizedCount > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-400">
          {data.uncategorizedCount} transaction(s) have unmapped categories and are excluded.{" "}
          <a href="/settings/mappings" className="underline underline-offset-2 hover:text-amber-300">
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
            <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-blue-400">
              FIXED
            </span>
          </div>
          <div className="space-y-2">
            <PillRow label="Actual" value={data.fixedActual} />
            <PillRow label="Budget" value={data.fixedBudget} />
            <div className="mt-1 border-t border-border/40 pt-2">
              <PillRow
                label="Control (Budget − Actual)"
                value={fixedControl}
                highlight={fixedControl >= 0 ? "good" : "bad"}
              />
            </div>
          </div>
        </div>

        {/* Variable pill */}
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-violet-400">
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
          </div>
        </div>

        {/* Savings — real first, then ideal, then gap */}
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-400">
              SAVINGS
            </span>
          </div>
          <div className="space-y-2">
            <PillRow
              label="Real (Salary − Actual)"
              value={data.realSavings}
              highlight={data.realSavings >= 0 ? "good" : "bad"}
            />
            <PillRow
              label="Ideal (Salary − Budget)"
              value={data.idealSavings}
              highlight={data.idealSavings >= 0 ? "good" : "bad"}
            />
            <div className="mt-1 border-t border-border/40 pt-2">
              <PillRow
                label="Gap (Real − Ideal)"
                value={data.savingsGap}
                highlight={data.savingsGap >= 0 ? "good" : "bad"}
              />
              <PillRow
                label="Unplanned Spend"
                value={data.unplannedSpendTotal}
                highlight={data.unplannedSpendTotal > 0 ? "bad" : "good"}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Category breakdown table ───────────────────────────────────── */}
      <Card className="overflow-hidden border-border/60">
        <CardHeader className="px-5 py-4 border-b border-border/60">
          <CardTitle className="text-sm font-semibold">Spend by Category</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="pl-5 text-xs uppercase tracking-wide text-muted-foreground">Category</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Type</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">Actual</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">Budget</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">Control</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground w-36">Progress</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="pr-5 text-xs uppercase tracking-wide text-muted-foreground">Severity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.categoryBreakdown.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn("border-border/40 transition-colors", rowBg(row.severity))}
                >
                  <TableCell className="pl-5 font-medium">{row.name}</TableCell>
                  <TableCell>
                    <TypePill type={row.budgetType} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {formatCOP(row.spent)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                    {formatCOP(row.budget)}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono text-sm tabular-nums", row.control < 0 ? "text-destructive" : "text-emerald-400")}>
                    {formatCOP(row.control)}
                  </TableCell>
                  <TableCell>
                    {row.percentUsed !== null ? (
                      <div className="flex items-center gap-2">
                        <ProgressBar percent={row.percentUsed} className="flex-1" />
                        <span className="font-mono text-xs tabular-nums text-muted-foreground w-9 text-right shrink-0">
                          {row.percentUsed.toFixed(0)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.status}</TableCell>
                  <TableCell className="pr-5">
                    <SeverityBadge severity={row.severity} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
    tone === "good" ? "text-emerald-400" :
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

function PillRow({
  label,
  value,
  rawValue,
  highlight,
}: {
  label: string;
  value?: number;
  rawValue?: string;
  highlight?: "good" | "bad";
}) {
  const displayValue = rawValue ?? (value !== undefined ? formatCOP(value) : "—");
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-xs font-medium tabular-nums",
          highlight === "good" && "text-emerald-400",
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
    percent >= 80  ? "bg-amber-500" :
    "bg-emerald-500";

  return (
    <div className={cn("h-1.5 w-full rounded-full bg-muted/50", className)}>
      <div
        className={cn("h-1.5 rounded-full transition-all", barColor)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function TypePill({ type }: { type: string }) {
  const isFixed = type === "FIXED";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        isFixed
          ? "border-blue-500/25 bg-blue-500/8 text-blue-400"
          : "border-violet-500/25 bg-violet-500/8 text-violet-400"
      )}
    >
      {isFixed ? "Fixed" : "Variable"}
    </span>
  );
}

function rowBg(severity: CategorySeverity) {
  switch (severity) {
    case "Critical":  return "bg-red-500/5 hover:bg-red-500/8";
    case "Issue":     return "bg-amber-500/5 hover:bg-amber-500/8";
    case "Unplanned": return "bg-orange-500/5 hover:bg-orange-500/8";
    default:          return "hover:bg-muted/30";
  }
}

function SeverityBadge({ severity }: { severity: CategorySeverity }) {
  const styles: Record<CategorySeverity, string> = {
    OK:        "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    Issue:     "border-amber-500/25 bg-amber-500/10 text-amber-400",
    Critical:  "border-red-500/25 bg-red-500/10 text-red-400",
    Unplanned: "border-orange-500/25 bg-orange-500/10 text-orange-400",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", styles[severity])}>
      {severity}
    </span>
  );
}
