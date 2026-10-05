import { Meter, Money, ReadingGrid } from "@/components/ds";
import { toneForBudgetUsed } from "@/lib/status";

function BudgetPace({
  expenses,
  budget,
  daysElapsed,
  daysInPeriod,
}: {
  expenses: number;
  budget: number;
  daysElapsed: number | null;
  daysInPeriod: number | null;
}) {
  const used = (expenses / budget) * 100;
  const dayPct = daysElapsed !== null && daysInPeriod ? (daysElapsed / daysInPeriod) * 100 : null;
  const ahead = dayPct !== null && used > dayPct;
  return (
    <>
      <Meter label="Budget used" value={used} max={100} target={dayPct ?? undefined} tone={toneForBudgetUsed(used)} />
      <span className="text-xs text-muted-foreground">
        {Math.round(used)}% of budget used
        {dayPct !== null && `, ${Math.round(dayPct)}% of the month gone (marker)`}
        {ahead && " — spending is ahead of the calendar"}.
      </span>
    </>
  );
}

function Readings({ income, expenses, balance, balanceLabel }: { income: number; expenses: number; balance: number; balanceLabel: string }) {
  const net = income - expenses;
  return (
    <ReadingGrid
      items={[
        { label: "Income", value: <Money value={income} signed tone={income > 0 ? "positive" : undefined} /> },
        { label: "Net so far", value: <Money value={net} signed tone={net < 0 ? "danger" : undefined} /> },
        { label: balanceLabel, value: <Money value={balance} tone={balance < 0 ? "danger" : undefined} /> },
      ]}
    />
  );
}

// Top of the Ledger: spending against the month's budget (with a "today"
// marker while the month is running), plus income, net and wallet balance.
// Replaces the three equal Income / Expenses / Total Balance cards. When a
// single wallet is selected the budget comparison doesn't apply (budgets are
// household-wide), so only the readings show.
export function LedgerSummary({
  income,
  expenses,
  balance,
  balanceLabel,
  budget,
  daysElapsed,
  daysInPeriod,
}: {
  income: number;
  expenses: number;
  balance: number;
  balanceLabel: string;
  /** null when a wallet filter is active */
  budget: number | null;
  daysElapsed: number | null;
  daysInPeriod: number | null;
}) {
  const hasBudget = budget !== null && budget > 0;
  return (
    <section className="grid gap-5 rounded-2xl border border-border/60 bg-card p-5 sm:p-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Spent this month
          </h2>
          {daysElapsed !== null && (
            <span className="text-xs text-muted-foreground">
              Day {daysElapsed} of {daysInPeriod}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <Money value={expenses} className="text-3xl font-semibold leading-none" />
          {hasBudget && (
            <span className="text-sm text-muted-foreground">
              of <Money value={budget} className="text-foreground" /> budget
            </span>
          )}
        </div>
        {hasBudget && (
          <BudgetPace expenses={expenses} budget={budget} daysElapsed={daysElapsed} daysInPeriod={daysInPeriod} />
        )}
      </div>
      <Readings income={income} expenses={expenses} balance={balance} balanceLabel={balanceLabel} />
    </section>
  );
}
