import Link from "next/link";
import { db } from "@/lib/db";
import { getMonthlyAnalysis } from "@/lib/queries/expenses";
import { getAllInstallments, getMonthSummary } from "@/lib/queries/installments";
import { getLoansOverview } from "@/lib/queries/loans";
import { formatCOP, MONTH_NAMES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { ExpenseDonut } from "./expense-donut";

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const color =
    tone === "good" ? "text-success" :
    tone === "bad"  ? "text-destructive" :
    "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-xl font-semibold", color)}>{value}</p>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Section link ─────────────────────────────────────────────────────────────

function ViewLink({ href, label = "View details" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      <ArrowRight className="size-3" />
    </Link>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export async function OverviewDashboard() {
  const batch = await db.importBatch.findFirst({
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  if (!batch) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
        No data yet. Import a month from the Expenses page to get started.
      </div>
    );
  }

  const allInstallments = await getAllInstallments();

  const [analysis, monthSummary, loans] = await Promise.all([
    getMonthlyAnalysis(batch.month, batch.year),
    getMonthSummary(batch.month, batch.year, allInstallments),
    getLoansOverview(),
  ]);

  const monthLabel = `${MONTH_NAMES[batch.month - 1]} ${batch.year}`;
  const burnTone =
    analysis.variableBurnRate === null ? "neutral" :
    analysis.variableBurnRate <= 80  ? "good" :
    analysis.variableBurnRate <= 100 ? "neutral" :
    "bad";
  const savingsTone =
    analysis.savingsRate === null ? "neutral" :
    analysis.savingsRate >= 20 ? "good" :
    analysis.savingsRate >= 10 ? "neutral" :
    "bad";

  const paid = monthSummary.dueThisMonth.filter((d) => d.payment !== null);
  const activeDebtors = loans.debtors.filter((d) => d.totalOwed > 0).length;

  return (
    <div className="space-y-6">
      {/* Period label */}
      <p className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">{monthLabel}</span>
        {" "}— last imported month
      </p>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Income"
          value={formatCOP(analysis.totalIncome)}
          tone="neutral"
        />
        <KpiCard
          label="Expenses"
          value={formatCOP(analysis.totalExpenses)}
          sub={`budget ${formatCOP(analysis.totalBudget)}`}
          tone={analysis.totalExpenses > analysis.totalBudget ? "bad" : "neutral"}
        />
        <KpiCard
          label="Savings Rate"
          value={analysis.savingsRate !== null ? `${analysis.savingsRate.toFixed(1)}%` : "—"}
          sub={formatCOP(analysis.realSavings)}
          tone={savingsTone}
        />
        <KpiCard
          label="Variable Burn"
          value={analysis.variableBurnRate !== null ? `${analysis.variableBurnRate.toFixed(1)}%` : "—"}
          sub="of variable budget"
          tone={burnTone}
        />
      </div>

      {/* Main content grid */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Expenses donut */}
        <Card className="border-border/60">
          <CardHeader className="px-5 py-4 border-b border-border/60">
            <CardTitle className="text-base font-semibold">Expenses by Category</CardTitle>
            <CardAction>
              <ViewLink href="/expenses" label="Full analysis" />
            </CardAction>
          </CardHeader>
          <CardContent className="px-5 py-5">
            <ExpenseDonut
              categories={analysis.categoryBreakdown.map((c) => ({
                name: c.name,
                spent: c.spent,
              }))}
              totalExpenses={analysis.totalExpenses}
              savingsRate={analysis.savingsRate}
            />
          </CardContent>
        </Card>

        {/* Right column: installments + loans */}
        <div className="space-y-4">

          {/* Installments */}
          <Card className="border-border/60">
            <CardHeader className="px-5 py-4 border-b border-border/60">
              <CardTitle className="text-base font-semibold">Installments</CardTitle>
              <CardAction>
                <ViewLink href="/installments" />
              </CardAction>
            </CardHeader>
            <CardContent className="px-5 py-4 space-y-3">
              {monthSummary.dueThisMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing due this month.</p>
              ) : (
                <>
                  {/* Summary line */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{paid.length}</span>
                      {" of "}
                      <span className="font-medium text-foreground">{monthSummary.dueThisMonth.length}</span>
                      {" paid"}
                    </span>
                    <span className="font-mono text-sm">
                      {monthSummary.totalDue > 0 ? (
                        <span className="text-destructive">{formatCOP(monthSummary.totalDue)} remaining</span>
                      ) : (
                        <span className="text-success">All paid ✓</span>
                      )}
                    </span>
                  </div>

                  {/* Item list */}
                  <div className="space-y-2">
                    {monthSummary.dueThisMonth.map((d) => {
                      const key = `${d.installment.id}-${d.installmentNum}`;
                      const isPaid = d.payment !== null;
                      return (
                        <div key={key} className="flex items-center gap-2.5 min-w-0">
                          {isPaid
                            ? <CheckCircle2 className="size-4 shrink-0 text-success" />
                            : <Circle className="size-4 shrink-0 text-muted-foreground/50" />
                          }
                          <span className={cn(
                            "flex-1 truncate text-sm",
                            isPaid ? "text-muted-foreground line-through" : "text-foreground"
                          )}>
                            {d.installment.description}
                            <span className="ml-1.5 text-xs text-muted-foreground/60">
                              #{d.installmentNum}/{d.installment.numInstallments}
                            </span>
                          </span>
                          <span className={cn(
                            "font-mono text-sm tabular-nums shrink-0",
                            isPaid ? "text-muted-foreground" : "text-foreground"
                          )}>
                            {formatCOP(d.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Loans snapshot */}
          <Card className="border-border/60">
            <CardHeader className="px-5 py-4 border-b border-border/60">
              <CardTitle className="text-base font-semibold">Loans</CardTitle>
              <CardAction>
                <ViewLink href="/loans" />
              </CardAction>
            </CardHeader>
            <CardContent className="px-5 py-4">
              {loans.inLoans === 0 && activeDebtors === 0 ? (
                <p className="text-sm text-muted-foreground">No outstanding loans.</p>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Outstanding</p>
                    <p className="font-mono text-lg font-semibold mt-1">{formatCOP(loans.inLoans)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Debtors</p>
                    <p className="font-mono text-lg font-semibold mt-1">{activeDebtors}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Liquidity</p>
                    <p className={cn(
                      "font-mono text-lg font-semibold mt-1",
                      loans.liquidityRatio !== null && loans.liquidityRatio < 30 ? "text-destructive" :
                      loans.liquidityRatio !== null && loans.liquidityRatio < 50 ? "text-warning" :
                      "text-foreground"
                    )}>
                      {loans.liquidityRatio !== null ? `${loans.liquidityRatio.toFixed(0)}%` : "—"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
