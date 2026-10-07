import { Meter, Money, ReadingGrid } from "@/components/ds";
import { toneForBudgetUsed } from "@/lib/status";

// Secondary line: the household's month spend against the month budget
// (budgets are household-wide, so this ignores the wallet), with a "today"
// marker while the month is running.
function MonthBudget({
  spent,
  budget,
  daysElapsed,
  daysInPeriod,
}: {
  spent: number;
  budget: number;
  daysElapsed: number | null;
  daysInPeriod: number | null;
}) {
  const used = (spent / budget) * 100;
  const dayPct = daysElapsed !== null && daysInPeriod ? (daysElapsed / daysInPeriod) * 100 : null;
  return (
    <div className="flex flex-col gap-1.5 border-t border-border/60 pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span>Month budget · all wallets</span>
        <span>
          <Money value={spent} compact className="text-foreground" /> of <Money value={budget} compact />
        </span>
      </div>
      <Meter
        label="Month budget used"
        size="sm"
        value={used}
        max={100}
        target={dayPct ?? undefined}
        tone={toneForBudgetUsed(used)}
      />
      <span className="text-xs text-muted-foreground">
        {Math.round(used)}% used
        {dayPct !== null && `, ${Math.round(dayPct)}% of the month gone`}
      </span>
    </div>
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

// Top of the Ledger, scoped by the selected wallet: what it spent this month
// (the big number), plus income, net and its balance. The month budget is
// household-wide, so it sits underneath as a secondary line for all wallets.
export function LedgerSummary({
  id,
  walletName,
  income,
  expenses,
  balance,
  budget,
  budgetSpent,
  daysElapsed,
  daysInPeriod,
}: {
  id?: string;
  /** The selected wallet; undefined = all wallets. */
  walletName: string | undefined;
  income: number;
  expenses: number;
  balance: number;
  /** Household month budget and spend (every wallet). */
  budget: number;
  budgetSpent: number;
  daysElapsed: number | null;
  daysInPeriod: number | null;
}) {
  return (
    <section
      id={id}
      className="grid scroll-mt-40 gap-5 rounded-2xl border border-border/60 bg-card p-5 sm:p-6 lg:grid-cols-[1.2fr_1fr] lg:items-center"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {walletName ? `Spent from ${walletName}` : "Spent · all wallets"}
          </h2>
          {daysElapsed !== null && (
            <span className="text-xs text-muted-foreground">
              Day {daysElapsed} of {daysInPeriod}
            </span>
          )}
        </div>
        <Money value={expenses} className="text-3xl font-semibold leading-none" />
        {budget > 0 && (
          <MonthBudget spent={budgetSpent} budget={budget} daysElapsed={daysElapsed} daysInPeriod={daysInPeriod} />
        )}
      </div>
      <Readings
        income={income}
        expenses={expenses}
        balance={balance}
        balanceLabel={walletName ? `${walletName} balance` : "Balance · all wallets"}
      />
    </section>
  );
}
