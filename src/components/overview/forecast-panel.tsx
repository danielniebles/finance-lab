import { TrendingDown, TrendingUp, Clock } from "lucide-react";
import { getForecast } from "@/lib/queries/forecast";
import { formatCOP } from "@/lib/format";
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
      <Card className="border-border/40 bg-muted/10">
        <CardContent className="px-5 py-4">
          <div className="flex items-center gap-3 text-muted-foreground/70">
            <Clock className="size-4 shrink-0" />
            <p className="text-xs">
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

  // De-emphasized on purpose (Overview redesign req 7): most entries here are
  // low-confidence projections, not actuals, so this reads as supporting
  // detail — smaller text, muted tones, a quieter background — rather than a
  // primary KPI. Same data/icons as before, just turned down.
  return (
    <Card className="border-border/40 bg-muted/10">
      <CardHeader className="px-5 py-3 border-b border-border/40">
        <CardTitle className="font-heading text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Forecast
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-4 space-y-4">

        {/* A — Projected savings rate strip */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
            Projected Savings Rate
          </p>

          <div className="flex items-end gap-2.5 flex-wrap">
            <span className="font-mono text-lg font-semibold tabular-nums leading-none text-muted-foreground">
              {rateStr}
            </span>

            {vsTargetStr && (
              <div className="flex items-center gap-1">
                {vsTargetPositive ? (
                  <TrendingUp className="size-3.5 text-muted-foreground/70" />
                ) : (
                  <TrendingDown className="size-3.5 text-muted-foreground/70" />
                )}
                <span className="text-xs font-medium tabular-nums text-muted-foreground/70">
                  {vsTargetStr}
                </span>
              </div>
            )}
          </div>

          {vsLastMonthStr && (
            <p className="text-xs text-muted-foreground/70">{vsLastMonthStr}</p>
          )}

          <p className="text-xs text-muted-foreground/50 italic">
            Projected from history · not a guarantee
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-border/40" />

        {/* B — Drivers list */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
            Categories at Risk
          </p>

          {drivers.length === 0 ? (
            <p className="text-xs text-muted-foreground/70">
              No categories projected to overshoot budget
            </p>
          ) : (
            <div className="divide-y divide-border/30">
              {drivers.map((driver) => {
                const isLowConfidence =
                  driver.prediction?.confidence === "low";
                const prefix = isLowConfidence ? "~" : "";

                return (
                  <div
                    key={driver.id}
                    className="py-2 first:pt-0 last:pb-0 space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate">
                        {driver.name}
                        {isLowConfidence && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground/50">
                            low confidence
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground shrink-0">
                        +{prefix}{formatCOP(driver.overByExpected)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60">
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
