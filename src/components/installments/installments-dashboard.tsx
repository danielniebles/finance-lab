import { getMonthSummary, getAllInstallments } from "@/lib/queries/installments";
import { formatCOP } from "@/lib/format";
import { MonthNav } from "./month-nav";
import { PayButton } from "./pay-button";
import { InstallmentActions } from "./installment-actions";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

function StatusBadge({ status }: { status: "Active" | "Finished" }) {
  if (status === "Finished") {
    return (
      <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
        Finished
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
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
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 border-border">
                  <TableHead className="px-4 text-xs uppercase tracking-wider text-muted-foreground">Item</TableHead>
                  <TableHead className="px-4 text-xs uppercase tracking-wider text-muted-foreground">Installment</TableHead>
                  <TableHead className="px-4 text-right text-xs uppercase tracking-wider text-muted-foreground">Amount</TableHead>
                  <TableHead className="px-4 text-right text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.dueThisMonth.map((due) => (
                  <TableRow key={`${due.installment.id}-${due.installmentNum}`} className="border-border">
                    <TableCell className="px-4 font-medium">{due.installment.description}</TableCell>
                    <TableCell className="px-4 text-muted-foreground font-mono text-xs">
                      {due.installmentNum} of {due.installment.numInstallments}
                    </TableCell>
                    <TableCell className="px-4 text-right font-mono">{formatCOP(due.amount)}</TableCell>
                    <TableCell className="px-4 text-right">
                      <PayButton
                        installmentId={due.installment.id}
                        installmentNum={due.installmentNum}
                        paymentId={due.payment?.id ?? null}
                        paidAt={due.payment?.paidAt ?? null}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="border-border">
                <TableRow className="border-border">
                  <TableCell colSpan={2} className="px-4 text-xs font-medium text-muted-foreground">
                    {summary.dueThisMonth.filter((d) => d.payment).length} of{" "}
                    {summary.dueThisMonth.length} paid
                  </TableCell>
                  <TableCell className="px-4 text-right font-mono font-semibold">
                    {formatCOP(summary.totalObligation)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
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
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30 border-border">
                  <TableHead className="px-4 text-xs uppercase tracking-wider text-muted-foreground">Item</TableHead>
                  <TableHead className="px-4 text-right text-xs uppercase tracking-wider text-muted-foreground">Total</TableHead>
                  <TableHead className="px-4 text-right text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Monthly</TableHead>
                  <TableHead className="px-4 text-center text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Progress</TableHead>
                  <TableHead className="px-4 text-right text-xs uppercase tracking-wider text-muted-foreground">Remaining</TableHead>
                  <TableHead className="px-4 text-center text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="px-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {allInstallments.map((inst) => (
                  <TableRow key={inst.id} className="border-border">
                    <TableCell className="px-4">
                      <div className="font-medium">{inst.description}</div>
                      {inst.notes && (
                        <div className="text-xs text-muted-foreground">{inst.notes}</div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 text-right font-mono text-sm">{formatCOP(inst.totalAmount)}</TableCell>
                    <TableCell className="px-4 text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
                      {formatCOP(inst.monthlyAmount)}
                    </TableCell>
                    <TableCell className="px-4 hidden sm:table-cell">
                      <div className="flex justify-center">
                        <ProgressBar paid={inst.installmentsPaid} total={inst.numInstallments} />
                      </div>
                    </TableCell>
                    <TableCell className="px-4 text-right font-mono text-sm">
                      {inst.remaining > 0 ? formatCOP(inst.remaining) : "—"}
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex justify-center">
                        <StatusBadge status={inst.status} />
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <InstallmentActions mode="row-actions" installment={inst} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
