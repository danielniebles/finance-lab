import { getTrends } from "@/lib/queries/trends";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { IncomeExpensesChart, SavingsRateChart } from "./trends-charts";
import { HealthScoreCard } from "./health-score-card";

export async function TrendsDashboard() {
  const data = await getTrends(6);

  if (data.months.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
        No data yet. Import at least one month to see trends.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <HealthScoreCard />
      {/* ── Charts row ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="px-5 py-4 border-b border-border/60">
            <CardTitle className="text-sm font-semibold">Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-4 pb-2">
            <IncomeExpensesChart data={data.months} />
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="px-5 py-4 border-b border-border/60">
            <CardTitle className="text-sm font-semibold">Savings Rate</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-4 pb-2">
            <SavingsRateChart data={data.months} />
          </CardContent>
        </Card>
      </div>

      {/* ── Category table ───────────────────────────────────────────────── */}
      <Card className="overflow-hidden border-border/60">
        <CardHeader className="px-5 py-4 border-b border-border/60">
          <CardTitle className="text-sm font-semibold">Spend by Category</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/20">
                <th className="px-5 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Category
                </th>
                {data.months.map((m) => (
                  <th
                    key={`${m.month}-${m.year}`}
                    className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.categoryTrends.map((row) => {
                const values = row.months.filter((v) => v !== null) as number[];
                const max = values.length ? Math.max(...values) : 0;

                return (
                  <tr key={row.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-2.5 font-medium">{row.name}</td>
                    {row.months.map((amount, i) => (
                      <td
                        key={i}
                        className={cn(
                          "px-3 py-2.5 text-right font-mono text-sm tabular-nums",
                          amount === null && "text-muted-foreground/40",
                          amount !== null && amount === max && max > 0 && "text-destructive"
                        )}
                      >
                        {amount !== null ? formatCOP(amount) : "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="border-t border-border/60 bg-muted/10">
                <td className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Total
                </td>
                {data.months.map((m) => {
                  const total = data.categoryTrends.reduce(
                    (s, row) => s + (row.months[data.months.indexOf(m)] ?? 0),
                    0
                  );
                  return (
                    <td
                      key={`${m.month}-${m.year}`}
                      className="px-3 py-2.5 text-right font-mono text-sm font-semibold tabular-nums"
                    >
                      {formatCOP(total)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
