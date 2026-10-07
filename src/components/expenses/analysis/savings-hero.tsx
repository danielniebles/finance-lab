import { Meter, Money, ReadingGrid } from "@/components/ds";
import { SAVINGS_RATE_TARGET, TONE_CLASSES, toneForSavingsRate } from "@/lib/status";
import { cn } from "@/lib/utils";

// Savings rate + totals in one card (replaces the five KPI boxes and the
// separate Savings panel, which repeated the same numbers).
export function SavingsHero({
  savingsRate,
  realSavings,
  totalIncome,
  totalExpenses,
  totalBudget,
  pendingFixed,
  daysElapsed,
  daysInPeriod,
}: {
  savingsRate: number | null;
  realSavings: number;
  totalIncome: number;
  totalExpenses: number;
  totalBudget: number;
  pendingFixed: number;
  daysElapsed: number | null;
  daysInPeriod: number | null;
}) {
  const tone = toneForSavingsRate(savingsRate);
  const inProgress = daysElapsed !== null;
  const left = totalBudget - totalExpenses;
  const vsTarget =
    savingsRate === null ? "" : savingsRate >= SAVINGS_RATE_TARGET ? "Above" : "Below";

  return (
    <section className="surface-glow grid gap-6 rounded-2xl border border-border/60 bg-card p-5 sm:p-6 lg:grid-cols-2 lg:items-center">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {inProgress ? "Savings rate so far" : "Savings rate"}
          </h2>
          {inProgress && (
            <span className="text-xs text-muted-foreground">
              Day {daysElapsed} of {daysInPeriod}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={cn("font-mono text-4xl font-semibold leading-none tabular-nums max-sm:text-3xl", TONE_CLASSES[tone].text)}>
            {savingsRate !== null ? `${savingsRate.toFixed(1)}%` : "—"}
          </span>
          <span className="text-sm text-muted-foreground">
            <Money value={realSavings} className="text-foreground" /> saved
          </span>
        </div>
        <Meter
          label="Savings rate against target"
          value={Math.max(0, savingsRate ?? 0)}
          max={SAVINGS_RATE_TARGET * 2}
          target={SAVINGS_RATE_TARGET}
          tone={tone}
        />
        <span className="text-xs text-muted-foreground">
          {vsTarget && `${vsTarget} the ${SAVINGS_RATE_TARGET}% target (marker).`}
          {pendingFixed > 0 && (
            <>
              {" "}
              <Money value={pendingFixed} /> of bills not paid yet.
            </>
          )}
        </span>
      </div>
      <ReadingGrid
        className="lg:grid-cols-2"
        items={[
          { label: "Income", value: <Money value={totalIncome} /> },
          { label: "Spent", value: <Money value={totalExpenses} /> },
          { label: "Budget", value: <Money value={totalBudget} /> },
          {
            label: left >= 0 ? "Left in budget" : "Over budget",
            value: <Money value={Math.abs(left)} tone={left >= 0 ? "positive" : "danger"} />,
          },
        ]}
      />
    </section>
  );
}
