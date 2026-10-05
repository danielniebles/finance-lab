import { formatShort } from "@/lib/format";
import type { MonthPoint } from "@/lib/queries/trends";
import { IncomeSpendingChart, INCOME_COLOR, SPENDING_COLOR, type ChartMonth } from "./trends-charts";

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className="size-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function toChartMonths(months: MonthPoint[]): ChartMonth[] {
  return months.map((m) => ({
    key: `${m.month}-${m.year}`,
    // A 12-month window can hold the same month twice — tag January with its year.
    label: m.month === 1 ? `${m.label.slice(0, 3)} ’${String(m.year).slice(2)}` : m.label.slice(0, 3),
    income: m.income,
    expenses: m.expenses,
    net: m.net,
    inProgress: m.inProgress,
  }));
}

export function IncomeSpendingCard({ months }: { months: MonthPoint[] }) {
  const budget = months[0]?.budget ?? 0;
  const running = months.find((m) => m.inProgress);
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">Income vs spending</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <Swatch color={INCOME_COLOR} label="Income" />
          <Swatch color={SPENDING_COLOR} label="Spending" />
          {budget > 0 && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="w-4 border-t-2 border-dashed border-muted-foreground" />
              Budget <span className="font-mono">{formatShort(budget)}</span>
            </span>
          )}
        </div>
      </div>
      <IncomeSpendingChart data={toChartMonths(months)} budget={budget} />
      <p className="text-xs text-muted-foreground">
        Net (income − spending) under each month.
        {running && ` ${MONTHS_LONG[running.month - 1]} is still running, so it's drawn as a draft and left out of averages.`}
      </p>
    </section>
  );
}
