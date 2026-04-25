import { getAllInstallments, getMonthSummary } from "@/lib/queries/installments";
import { formatCOP } from "@/lib/format";
import { MonthNav } from "./month-nav";
import { DueThisMonthTable } from "./due-this-month-table";
import { AllInstallmentsTable } from "./all-installments-table";

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "good" | "bad" | "neutral";
}) {
  const valueColor =
    highlight === "good"
      ? "text-success"
      : highlight === "bad"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`font-mono text-xl font-semibold ${valueColor}`}>{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

export async function InstallmentsDashboard({
  month,
  year,
}: {
  month: number;
  year: number;
}) {
  // Single DB fetch — summary reuses the same array, no second round-trip
  const allInstallments = await getAllInstallments();
  const summary = await getMonthSummary(month, year, allInstallments);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Installments</h1>
          <p className="text-sm text-muted-foreground">Credit card installment tracker</p>
        </div>
        <MonthNav month={month} year={year} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        <StatCard
          label="Total obligation"
          value={formatCOP(summary.totalObligation)}
          sub="due this month"
        />
        <StatCard
          label="Paid so far"
          value={formatCOP(summary.totalPaid)}
          highlight={summary.totalPaid > 0 ? "good" : "neutral"}
        />
        <StatCard
          label="Still due"
          value={formatCOP(summary.totalDue)}
          highlight={summary.totalDue > 0 ? "bad" : "good"}
        />
        <StatCard
          label="Active installments"
          value={String(summary.activeCount)}
        />
        <StatCard
          label="Total debt"
          value={formatCOP(summary.totalRemainingDebt)}
          sub="all remaining balances"
          highlight={summary.totalRemainingDebt > 0 ? "bad" : "good"}
        />
      </div>

      {/* Due this month */}
      <section className="space-y-3">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Payments due this month
        </h2>
        {summary.dueThisMonth.length === 0 ? (
          <p className="text-sm text-muted-foreground">No installments due this month.</p>
        ) : (
          <DueThisMonthTable
            dueThisMonth={summary.dueThisMonth}
            totalObligation={summary.totalObligation}
          />
        )}
      </section>

      {/* All installments */}
      <AllInstallmentsTable installments={allInstallments} />
    </div>
  );
}
