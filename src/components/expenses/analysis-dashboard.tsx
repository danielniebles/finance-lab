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
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Props = { month: number; year: number };

export async function AnalysisDashboard({ month, year }: Props) {
  const data = await getMonthlyAnalysis(month, year);

  const fixedControl = data.fixedBudget - data.fixedActual;
  const variableControl = data.variableBudget - data.variableActual;

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

      {/* ── Top stat strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Monthly Income"
          value={data.totalIncome}
          tone="neutral"
        />
        <StatCard
          label="Total Expenses"
          value={data.totalExpenses}
          tone="neutral"
        />
        <StatCard
          label="Total Budget"
          value={data.totalBudget}
          tone="neutral"
        />
        <StatCard
          label="Over / Under Budget"
          value={-data.overexpense}
          tone={data.overexpense > 0 ? "bad" : "good"}
          showTrend
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
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-violet-400">
              VARIABLE
            </span>
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
              {data.variableBurnRate !== null && (
                <PillRow
                  label="Burn Rate"
                  rawValue={`${data.variableBurnRate.toFixed(1)}%`}
                  highlight={data.variableBurnRate > 100 ? "bad" : "good"}
                />
              )}
            </div>
          </div>
        </div>

        {/* Savings */}
        <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-400">
              SAVINGS
            </span>
          </div>
          <div className="space-y-2">
            <PillRow
              label="Ideal (Salary − Budget)"
              value={data.idealSavings}
              highlight={data.idealSavings >= 0 ? "good" : "bad"}
            />
            <PillRow
              label="Real (Salary − Actual)"
              value={data.realSavings}
              highlight={data.realSavings >= 0 ? "good" : "bad"}
            />
            <div className="mt-1 border-t border-border/40 pt-2">
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
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">% Used</TableHead>
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
                  <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                    {row.percentUsed !== null ? `${row.percentUsed.toFixed(0)}%` : "—"}
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
  tone,
  showTrend,
}: {
  label: string;
  value: number;
  tone: "good" | "bad" | "neutral";
  showTrend?: boolean;
}) {
  const valueColor =
    tone === "good" ? "text-emerald-400" :
    tone === "bad" ? "text-destructive" :
    "text-foreground";

  const TrendIcon =
    tone === "good" ? TrendingUp :
    tone === "bad" ? TrendingDown :
    Minus;

  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
        {label}
      </p>
      <div className="flex items-end justify-between gap-2">
        <p className={cn("font-mono text-lg font-semibold tabular-nums leading-tight", valueColor)}>
          {formatCOP(Math.abs(value))}
        </p>
        {showTrend && (
          <TrendIcon className={cn("size-4 shrink-0 mb-0.5", valueColor)} />
        )}
      </div>
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
