import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getHealthScore, type HealthScoreMetric, type HealthScoreTier } from "@/lib/queries/health-score";

const tierStyles: Record<HealthScoreTier, { text: string; badge: string }> = {
  Excellent: {
    text: "text-success",
    badge: "border-success/30 bg-success/10 text-success",
  },
  Good: {
    text: "text-blue-600 dark:text-blue-400",
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  Fair: {
    text: "text-warning",
    badge: "border-warning/30 bg-warning/10 text-warning",
  },
  "At Risk": {
    text: "text-destructive",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

const barColor: Record<HealthScoreMetric["status"], string> = {
  good: "bg-success",
  warn: "bg-warning",
  bad: "bg-destructive",
  na: "bg-muted-foreground/30",
};

function MetricRow({ metric }: { metric: HealthScoreMetric }) {
  const pct = (metric.points / 25) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 text-xs text-muted-foreground">{metric.label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-muted/50">
        <div
          className={cn("h-1.5 rounded-full transition-all", barColor[metric.status])}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {metric.rawValue}
      </span>
      <span
        className={cn(
          "w-8 text-right font-mono text-xs tabular-nums",
          metric.status === "na"
            ? "text-muted-foreground/40"
            : metric.status === "good"
            ? "text-success"
            : metric.status === "warn"
            ? "text-warning"
            : "text-destructive"
        )}
      >
        {metric.status === "na" ? "—" : `+${metric.points}`}
      </span>
    </div>
  );
}

export async function HealthScoreCard() {
  const data = await getHealthScore();

  if (!data) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No data yet. Import at least one month to see your health score.
      </div>
    );
  }

  const styles = tierStyles[data.tier];

  return (
    <Card className="border-border/60">
      <CardHeader className="px-5 py-4 border-b border-border/60">
        <CardTitle className="text-sm font-semibold">Financial Health</CardTitle>
        <CardAction>
          <span className="text-xs text-muted-foreground">{data.monthLabel}</span>
        </CardAction>
      </CardHeader>
      <CardContent className="px-5 py-5">
        <div className="flex items-start gap-8">
          <div className="flex flex-col items-center gap-2">
            <span className={cn("font-mono text-5xl font-bold tabular-nums", styles.text)}>
              {data.score}
            </span>
            <span
              className={cn(
                "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                styles.badge
              )}
            >
              {data.tier}
            </span>
            {data.scoreDelta !== null && data.scoreDelta !== 0 && (
              <span
                className={cn(
                  "text-xs font-mono tabular-nums",
                  data.scoreDelta > 0 ? "text-success" : "text-destructive"
                )}
              >
                {data.scoreDelta > 0 ? "+" : ""}{data.scoreDelta} vs prev
              </span>
            )}
            {data.scoreDelta === 0 && (
              <span className="text-xs text-muted-foreground/60">= vs prev</span>
            )}
          </div>
          <div className="flex-1 space-y-3 pt-1">
            {data.metrics.map((m) => (
              <MetricRow key={m.label} metric={m} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
