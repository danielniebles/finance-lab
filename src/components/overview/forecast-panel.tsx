import { TrendingDown, TrendingUp, Clock } from "lucide-react";
import { getForecast } from "@/lib/queries/forecast";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ForecastPanelProps {
  month: number;
  year: number;
}

export async function ForecastPanel({ month, year }: ForecastPanelProps) {
  const data = await getForecast(month, year);

  // ── Thin-data state ──────────────────────────────────────────────────────────
  if (data.dataSufficiency === "thin") {
    return (
      <Card className="border-border/60">
        <CardContent className="px-5 py-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Clock className="size-5 shrink-0" />
            <p className="text-sm">
              Need a few more months of history to forecast
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Ok-data state ────────────────────────────────────────────────────────────
  const { projectedSavingsRate, vsTarget, vsLastMonth, drivers } = data;

  const rateStr =
    projectedSavingsRate !== null
      ? `${projectedSavingsRate.toFixed(1)}%`
      : "—";

  const vsTargetStr =
    vsTarget !== null
      ? `${vsTarget >= 0 ? "+" : ""}${vsTarget.toFixed(1)} pp vs target`
      : null;

  const vsLastMonthStr =
    vsLastMonth !== null
      ? `${vsLastMonth >= 0 ? "+" : ""}${vsLastMonth.toFixed(1)} pp vs last month`
      : null;

  const vsTargetPositive = vsTarget !== null && vsTarget >= 0;

  return (
    <Card className="border-border/60">
      <CardHeader className="px-5 py-4 border-b border-border/60">
        <CardTitle className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-5 space-y-5">

        {/* A — Projected savings rate strip */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Projected Savings Rate
          </p>

          <div className="flex items-end gap-3 flex-wrap">
            <span
              className={cn(
                "font-mono text-3xl font-semibold tabular-nums leading-none",
                projectedSavingsRate === null
                  ? "text-foreground"
                  : projectedSavingsRate >= 20
                  ? "text-success"
                  : projectedSavingsRate >= 10
                  ? "text-warning"
                  : "text-destructive",
              )}
            >
              {rateStr}
            </span>

            {vsTargetStr && (
              <div className="flex items-center gap-1 mb-0.5">
                {vsTargetPositive ? (
                  <TrendingUp className="size-4 text-success" />
                ) : (
                  <TrendingDown className="size-4 text-destructive" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    vsTargetPositive ? "text-success" : "text-destructive",
                  )}
                >
                  {vsTargetStr}
                </span>
              </div>
            )}
          </div>

          {vsLastMonthStr && (
            <p className="text-xs text-muted-foreground">{vsLastMonthStr}</p>
          )}

          <p className="text-xs text-muted-foreground/60 italic">
            Projected from history · not a guarantee
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-border/60" />

        {/* B — Drivers list */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Categories at Risk
          </p>

          {drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No categories projected to overshoot budget
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {drivers.map((driver) => {
                const isLowConfidence =
                  driver.prediction?.confidence === "low";
                const prefix = isLowConfidence ? "~" : "";

                return (
                  <div
                    key={driver.id}
                    className="py-2.5 first:pt-0 last:pb-0 space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground truncate">
                        {driver.name}
                        {isLowConfidence && (
                          <span className="ml-1.5 text-xs text-muted-foreground/60">
                            low confidence
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-sm tabular-nums text-destructive shrink-0">
                        +{prefix}{formatCOP(driver.overByExpected)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Budget:{" "}
                      <span className="font-mono tabular-nums">
                        {formatCOP(driver.budget)}
                      </span>
                      {" · "}Projected:{" "}
                      <span className="font-mono tabular-nums">
                        {prefix}
                        {driver.prediction
                          ? formatCOP(driver.prediction.expected)
                          : "—"}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
