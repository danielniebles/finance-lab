import { getMonthSummary, getAllInstallments } from "@/lib/queries/installments";
import { formatCOP } from "@/lib/format";
import { MonthNav } from "./month-nav";
import { PayButton } from "./pay-button";
import { InstallmentActions } from "./installment-actions";

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
      ? "text-emerald-400"
      : highlight === "bad"
      ? "text-red-400"
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

function StatusBadge({ status }: { status: "Active" | "Finished" }) {
  if (status === "Finished") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
        Finished
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
      Active
    </span>
  );
}

function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-muted-foreground">
        {paid}/{total}
      </span>
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
  const [summary, allInstallments] = await Promise.all([
    getMonthSummary(month, year),
    getAllInstallments(),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
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
          label="Active items"
          value={String(summary.activeCount)}
          sub="installments"
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
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Installment
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.dueThisMonth.map((due) => (
                  <tr key={`${due.installment.id}-${due.installmentNum}`} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{due.installment.description}</td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {due.installmentNum} of {due.installment.numInstallments}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatCOP(due.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PayButton
                        installmentId={due.installment.id}
                        installmentNum={due.installmentNum}
                        paymentId={due.payment?.id ?? null}
                        paidAt={due.payment?.paidAt ?? null}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/30">
                  <td colSpan={2} className="px-4 py-3 text-xs font-medium text-muted-foreground">
                    {summary.dueThisMonth.filter((d) => d.payment).length} of{" "}
                    {summary.dueThisMonth.length} paid
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {formatCOP(summary.totalObligation)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* All installments */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            All installments
          </h2>
          <InstallmentActions mode="add-button" />
        </div>

        {allInstallments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No installments yet. Add one above.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Item
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Monthly
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Progress
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Remaining
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allInstallments.map((inst) => (
                  <tr key={inst.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{inst.description}</div>
                      {inst.notes && (
                        <div className="text-xs text-muted-foreground">{inst.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {formatCOP(inst.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                      {formatCOP(inst.monthlyAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <ProgressBar
                          paid={inst.installmentsPaid}
                          total={inst.numInstallments}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {inst.remaining > 0 ? formatCOP(inst.remaining) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <StatusBadge status={inst.status} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <InstallmentActions mode="row-actions" installment={inst} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
