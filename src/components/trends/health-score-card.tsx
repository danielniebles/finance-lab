import { Meter, StatusChip } from "@/components/ds";
import { toneForMetricStatus, toneForTier } from "@/lib/health-score-utils";
import { getHealthScore, type HealthScore, type HealthScoreMetric } from "@/lib/queries/health-score";
import { TONE_CLASSES } from "@/lib/status";
import { cn } from "@/lib/utils";

function MetricTile({ metric }: { metric: HealthScoreMetric }) {
  const tone = toneForMetricStatus(metric.status);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{metric.label}</span>
        <span className={cn("font-mono text-sm font-semibold", TONE_CLASSES[tone].text)}>{metric.rawValue}</span>
      </div>
      <Meter
        value={Math.max(0, metric.value ?? 0)}
        max={metric.scaleMax}
        target={metric.targetValue}
        tone={tone}
        size="sm"
        label={`${metric.label}: ${metric.rawValue}, ${metric.target}`}
      />
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {metric.target}
        <span className="font-mono">{metric.status === "na" ? "—" : `${metric.points}/25`}</span>
      </span>
    </div>
  );
}

function Delta({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta === 0) return <span className="text-xs text-muted-foreground">same as previous month</span>;
  return (
    <span className={cn("font-mono text-xs", TONE_CLASSES[delta > 0 ? "positive" : "danger"].text)}>
      {delta > 0 ? "+" : "−"}
      {Math.abs(delta)} vs previous month
    </span>
  );
}

/** Score of the last complete month, with each metric shown against its target. */
export async function HealthScoreCard() {
  return <HealthScoreView data={await getHealthScore()} />;
}

export function HealthScoreView({ data }: { data: HealthScore | null }) {
  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Your health score appears once a full month has been logged.
      </div>
    );
  }

  const tone = toneForTier(data.tier);
  return (
    <section className="surface-glow grid gap-6 rounded-2xl border border-border/60 bg-card p-5 sm:p-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-center">
      <div className="flex flex-col gap-2">
        <h2 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Financial health · {data.monthLabel}
        </h2>
        <p className="flex items-baseline gap-2">
          <span className={cn("font-mono text-6xl font-semibold leading-none", TONE_CLASSES[tone].text)}>{data.score}</span>
          <span className="font-mono text-sm text-muted-foreground">/ 100</span>
        </p>
        <span className="flex flex-wrap items-center gap-2">
          <StatusChip tone={tone}>{data.tier}</StatusChip>
          <Delta delta={data.scoreDelta} />
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.metrics.map((m) => (
          <MetricTile key={m.key} metric={m} />
        ))}
      </div>
    </section>
  );
}
