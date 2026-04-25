import { getTrends } from "@/lib/queries/trends";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { IncomeExpensesChart, NetBalanceChart } from "./trends-charts";
import { HealthScoreCard } from "./health-score-card";

// ─── Trend: deviation of most recent month from period average ───────────────

function trendDelta(months: (number | null)[]): number | null {
  const values = months.filter((v): v is number => v !== null);
  if (values.length < 2) return null;
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  if (avg === 0) return null;
  const last = values[values.length - 1];
  return ((last - avg) / avg) * 100;
}

function TrendBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-muted-foreground/40">—</span>;
  const abs = Math.abs(delta).toFixed(0);
  // For expenses: below avg is good (green), above avg is bad (red)
  if (delta <= -5) return <span className="text-success font-mono text-xs">↓{abs}%</span>;
  if (delta >= 5)  return <span className="text-destructive font-mono text-xs">↑{abs}%</span>;
  return <span className="text-muted-foreground font-mono text-xs">~{abs}%</span>;
}

// ─── Period toggle ─────────────────────────────────────────────────────────────

function PeriodToggle({ current }: { current: number }) {
  const options = [3, 6, 12] as const;
  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-0.5">
      {options.map((n) => (
        <a
          key={n}
          href={`?period=${n}`}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            current === n
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {n}mo
        </a>
      ))}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export async function TrendsDashboard({ period = 6 }: { period?: number }) {
  const data = await getTrends(period);

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
            <CardAction>
              <PeriodToggle current={period} />
            </CardAction>
          </CardHeader>
          <CardContent className="px-4 pt-4 pb-2">
            <IncomeExpensesChart data={data.months} />
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="px-5 py-4 border-b border-border/60">
            <CardTitle className="text-sm font-semibold">Monthly Net Balance</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pt-4 pb-2">
            <NetBalanceChart data={data.months} />
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
                <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  Budget/mo
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  Avg
                </th>
                {data.months.map((m) => (
                  <th
                    key={`${m.month}-${m.year}`}
                    className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap"
                  >
                    {m.label}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  vs avg
                </th>
              </tr>
            </thead>
            <tbody>
              {data.categoryTrends.map((row) => {
                const values = row.months.filter((v): v is number => v !== null);
                const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
                const delta = trendDelta(row.months);

                return (
                  <tr key={row.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                    <td className="px-5 py-2.5 font-medium">{row.name}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground tabular-nums">
                      {row.budget > 0 ? formatCOP(row.budget) : "—"}
                    </td>
                    <td className={cn(
                      "px-3 py-2.5 text-right font-mono text-xs tabular-nums",
                      avg !== null && row.budget > 0
                        ? avg > row.budget ? "text-destructive" : "text-success"
                        : "text-muted-foreground"
                    )}>
                      {avg !== null ? formatCOP(Math.round(avg)) : "—"}
                    </td>
                    {row.months.map((amount, i) => (
                      <td
                        key={i}
                        className={cn(
                          "px-3 py-2.5 text-right font-mono text-sm tabular-nums",
                          amount === null ? "text-muted-foreground/40" : "text-foreground"
                        )}
                      >
                        {amount !== null ? formatCOP(amount) : "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right">
                      <TrendBadge delta={delta} />
                    </td>
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
                <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground tabular-nums">
                  {formatCOP(data.categoryTrends.reduce((s, r) => s + r.budget, 0))}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground tabular-nums">
                  —
                </td>
                {data.months.map((m) => {
                  const idx = data.months.indexOf(m);
                  const total = data.categoryTrends.reduce(
                    (s, row) => s + (row.months[idx] ?? 0),
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
                <td className="px-3 py-2.5" />
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
