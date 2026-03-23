import { getMonthlyAnalysis, type CategorySeverity } from "@/lib/queries/expenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

type Props = { month: number; year: number };

export async function AnalysisDashboard({ month, year }: Props) {
  const data = await getMonthlyAnalysis(month, year);

  return (
    <div className="space-y-6">
      {/* Unmapped warning */}
      {data.uncategorizedCount > 0 && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          {data.uncategorizedCount} transaction(s) have unmapped categories and are excluded from the analysis.{" "}
          <a href="/settings/mappings" className="underline">
            Configure mappings →
          </a>
        </div>
      )}

      {/* KPI panels */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Overall */}
        <KpiCard title="Overall">
          <KpiRow label="Salary" value={data.totalIncome} />
          <KpiRow label="Total Actual Expenses" value={data.totalExpenses} />
          <KpiRow label="Total Budget" value={data.totalBudget} />
          <KpiRow
            label="Overexpense (Actual − Budget)"
            value={data.overexpense}
            highlight={data.overexpense > 0 ? "bad" : "good"}
          />
        </KpiCard>

        {/* Fixed vs Variable */}
        <KpiCard title="Fixed vs Variable">
          <KpiRow label="Fixed Actual" value={data.fixedActual} />
          <KpiRow label="Fixed Budget" value={data.fixedBudget} />
          <KpiRow
            label="Fixed Control (Budget − Actual)"
            value={data.fixedBudget - data.fixedActual}
            highlight={data.fixedBudget - data.fixedActual >= 0 ? "good" : "bad"}
          />
          <div className="my-1 border-t" />
          <KpiRow label="Variable Actual" value={data.variableActual} />
          <KpiRow label="Variable Budget" value={data.variableBudget} />
          <KpiRow
            label="Variable Control (Budget − Actual)"
            value={data.variableBudget - data.variableActual}
            highlight={data.variableBudget - data.variableActual >= 0 ? "good" : "bad"}
          />
          {data.variableBurnRate !== null && (
            <KpiRow
              label="Variable Burn Rate"
              rawValue={`${data.variableBurnRate.toFixed(1)}%`}
              highlight={data.variableBurnRate > 100 ? "bad" : "good"}
            />
          )}
        </KpiCard>

        {/* Savings */}
        <KpiCard title="Savings">
          <KpiRow
            label="Ideal Savings (Salary − Budget)"
            value={data.idealSavings}
            highlight={data.idealSavings >= 0 ? "good" : "bad"}
          />
          <KpiRow
            label="Real Savings (Salary − Actual)"
            value={data.realSavings}
            highlight={data.realSavings >= 0 ? "good" : "bad"}
          />
          <div className="my-1 border-t" />
          <KpiRow
            label="Unplanned Spend Total"
            value={data.unplannedSpendTotal}
            highlight={data.unplannedSpendTotal > 0 ? "bad" : "good"}
          />
        </KpiCard>
      </div>

      {/* Category breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spend by Category</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Control</TableHead>
                <TableHead className="text-right">% Used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Severity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.categoryBreakdown.map((row) => (
                <TableRow key={row.id} className={rowBg(row.severity)}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{row.budgetType}</TableCell>
                  <TableCell className="text-right">{formatCOP(row.spent)}</TableCell>
                  <TableCell className="text-right">{formatCOP(row.budget)}</TableCell>
                  <TableCell className={cn("text-right", row.control < 0 && "text-destructive")}>
                    {formatCOP(row.control)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {row.percentUsed !== null ? `${row.percentUsed.toFixed(0)}%` : "—"}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{row.status}</span>
                  </TableCell>
                  <TableCell>
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

// ─── helpers ──────────────────────────────────────────────────────────────────

function rowBg(severity: CategorySeverity) {
  switch (severity) {
    case "Critical":
      return "bg-red-50";
    case "Issue":
      return "bg-yellow-50";
    case "Unplanned":
      return "bg-orange-50";
    default:
      return "";
  }
}

function SeverityBadge({ severity }: { severity: CategorySeverity }) {
  const styles: Record<CategorySeverity, string> = {
    OK: "bg-green-100 text-green-800 border-green-200",
    Issue: "bg-yellow-100 text-yellow-800 border-yellow-200",
    Critical: "bg-red-100 text-red-800 border-red-200",
    Unplanned: "bg-orange-100 text-orange-800 border-orange-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        styles[severity]
      )}
    >
      {severity}
    </span>
  );
}

function KpiCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-1.5">{children}</CardContent>
    </Card>
  );
}

function KpiRow({
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
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-medium tabular-nums",
          highlight === "good" && "text-green-700",
          highlight === "bad" && "text-destructive"
        )}
      >
        {displayValue}
      </span>
    </div>
  );
}
