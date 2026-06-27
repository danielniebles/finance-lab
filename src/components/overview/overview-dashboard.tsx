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

// ─── Budget vs Actual panel ───────────────────────────────────────────────────

interface BudgetBarProps {
  label: string;
  valueStr: string;
  pct: number;
  fillClass: string;
}

function BudgetBar({ label, valueStr, pct, fillClass }: BudgetBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-xs tabular-nums text-foreground">{valueStr}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-muted/40 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", fillClass)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

interface BudgetBarsPanelProps {
  variableBurnRate: number | null;
  variableActual: number;
  variableBudget: number;
  fixedActual: number;
  fixedBudget: number;
  savingsRate: number | null;
}

function BudgetBarsPanel({
  variableBurnRate,
  fixedActual,
  fixedBudget,
  savingsRate,
}: BudgetBarsPanelProps) {
  const variablePct = variableBurnRate ?? 0;
  const variableStr = variableBurnRate !== null ? `${variableBurnRate.toFixed(1)}%` : "—";
  const variableFill = variablePct <= 100 ? "bg-primary" : "bg-destructive";

  const fixedPct = fixedBudget > 0 ? (fixedActual / fixedBudget) * 100 : 0;
  const fixedStr = `${fixedPct.toFixed(1)}%`;
  const fixedFill = fixedPct <= 100 ? "bg-primary" : "bg-destructive";

  const savingsPct = savingsRate !== null ? Math.min(savingsRate, 20) / 20 * 100 : 0;
  const savingsStr = savingsRate !== null ? `${savingsRate.toFixed(1)}%` : "—";
  const savingsFill =
    savingsRate === null ? "bg-destructive" :
    savingsRate >= 20 ? "bg-success" :
    savingsRate >= 10 ? "bg-warning" :
    "bg-destructive";

  return (
    <Card className="border-border/60">
      <CardHeader className="px-5 py-4 border-b border-border/60">
        <CardTitle className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Budget vs Actual
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-4 space-y-4">
        <BudgetBar label="Variable Spending" valueStr={variableStr} pct={variablePct} fillClass={variableFill} />
        <BudgetBar label="Fixed Costs" valueStr={fixedStr} pct={fixedPct} fillClass={fixedFill} />
        <BudgetBar label="Savings Target" valueStr={savingsStr} pct={savingsPct} fillClass={savingsFill} />
      </CardContent>
    </Card>
  );
}

// ─── Top Unplanned panel ──────────────────────────────────────────────────────

interface CategoryBreakdownItem {
  name: string;
  spent: number;
  severity: string;
}

interface TopUnplannedPanelProps {
  categoryBreakdown: CategoryBreakdownItem[];
}

function TopUnplannedPanel({ categoryBreakdown }: TopUnplannedPanelProps) {
  const items = categoryBreakdown
    .filter((c) => c.severity === "Unplanned")
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 3);

  return (
    <Card className="border-border/60">
      <CardHeader className="px-5 py-4 border-b border-border/60">
        <CardTitle className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Top Unplanned
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No unplanned spend this month.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {items.map((item) => (
              <div key={item.name} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                <span className="text-sm text-foreground">{item.name}</span>
                <span className="font-mono text-sm tabular-nums text-destructive">
                  {formatCOP(item.spent)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
  const unpaid = monthSummary.dueThisMonth.filter((d) => d.payment === null);
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
      <div className="grid gap-4 lg:grid-cols-12">

        {/* Left column: donut + budget bars + top unplanned */}
        <div className="lg:col-span-7 space-y-4">
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
              />
            </CardContent>
          </Card>

          <BudgetBarsPanel
            variableBurnRate={analysis.variableBurnRate}
            variableActual={analysis.variableActual}
            variableBudget={analysis.variableBudget}
            fixedActual={analysis.fixedActual}
            fixedBudget={analysis.fixedBudget}
            savingsRate={analysis.savingsRate}
          />

          <TopUnplannedPanel categoryBreakdown={analysis.categoryBreakdown} />
        </div>

        {/* Right column: installments + loans */}
        <div className="lg:col-span-5 space-y-4">

          {/* Installments */}
          <Card className="border-border/60">
            <CardHeader className="px-5 py-4 border-b border-border/60">
              <CardTitle className="text-base font-semibold">Installments</CardTitle>
              <CardAction>
                {monthSummary.dueThisMonth.length > 0 ? (
                  monthSummary.totalDue > 0 ? (
                    <span className="font-mono text-sm text-destructive tabular-nums">
                      {formatCOP(monthSummary.totalDue)} remaining
                    </span>
                  ) : (
                    <span className="text-sm text-success">All paid ✓</span>
                  )
                ) : (
                  <ViewLink href="/installments" />
                )}
              </CardAction>
            </CardHeader>
            <CardContent className="px-5 py-4 space-y-2">
              {unpaid.length === 0 && paid.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing due this month.</p>
              ) : (
                <>
                  {unpaid.length > 0 && (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Upcoming
                      </p>
                      <div className="space-y-2">
                        {unpaid.map((d) => {
                          const key = `${d.installment.id}-${d.installmentNum}`;
                          return (
                            <div key={key} className="flex items-center gap-2.5 min-w-0">
                              <Circle className="size-4 shrink-0 text-muted-foreground/50" />
                              <span className="flex-1 truncate text-sm text-foreground">
                                {d.installment.description}
                                <span className="ml-1.5 text-xs text-muted-foreground/60">
                                  #{d.installmentNum}/{d.installment.numInstallments}
                                </span>
                              </span>
                              <span className="font-mono text-sm tabular-nums shrink-0 text-foreground">
                                {formatCOP(d.amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {paid.length > 0 && (
                    <div className="opacity-40 mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Paid this cycle
                      </p>
                      <div className="space-y-2">
                        {paid.map((d) => {
                          const key = `${d.installment.id}-${d.installmentNum}`;
                          return (
                            <div key={key} className="flex items-center gap-2.5 min-w-0">
                              <CheckCircle2 className="size-4 shrink-0 text-success" />
                              <span className="flex-1 truncate text-sm text-foreground">
                                {d.installment.description}
                                <span className="ml-1.5 text-xs text-muted-foreground/60">
                                  #{d.installmentNum}/{d.installment.numInstallments}
                                </span>
                              </span>
                              <span className="font-mono text-sm tabular-nums shrink-0 text-foreground">
                                {formatCOP(d.amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
              ) : (() => {
                const ratio = loans.liquidityRatio ?? 0;
                const pct = Math.min(ratio, 100);
                let severity: "Critical" | "Warning" | "Good";
                let badgeBg: string;
                let badgeText: string;
                let dotClass: string;
                let barClass: string;
                let message: string;

                if (ratio < 30) {
                  severity = "Critical";
                  badgeBg = "bg-destructive/10";
                  badgeText = "text-destructive";
                  dotClass = "bg-destructive";
                  barClass = "bg-destructive";
                  message = "Cash reserves are below 30% of total debt exposure.";
                } else if (ratio < 50) {
                  severity = "Warning";
                  badgeBg = "bg-warning/10";
                  badgeText = "text-warning";
                  dotClass = "bg-warning";
                  barClass = "bg-warning";
                  message = "Cash reserves are below 50% of total debt exposure.";
                } else {
                  severity = "Good";
                  badgeBg = "bg-success/10";
                  badgeText = "text-success";
                  dotClass = "bg-success";
                  barClass = "bg-primary";
                  message = "Liquidity is healthy relative to total debt exposure.";
                }

                return (
                  <div className="space-y-4">
                    {/* Zone 1 — top metrics row */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Outstanding</p>
                        <p className="font-mono text-2xl font-semibold mt-1">{formatCOP(loans.inLoans)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Debtors</p>
                        <p className="font-mono text-2xl font-semibold mt-1">{activeDebtors}</p>
                      </div>
                    </div>

                    {/* Divider */}
                    {loans.liquidityRatio !== null && (
                      <>
                        <div className="border-t border-border/60" />

                        {/* Zone 2 — Liquidity Health */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Liquidity Health
                            </span>
                            <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold", badgeBg)}>
                              <span className={cn("size-1.5 rounded-full", dotClass, severity === "Critical" && "animate-pulse")} />
                              <span className={badgeText}>{severity} ({loans.liquidityRatio.toFixed(0)}%)</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                            <div className={cn("h-full rounded-full", barClass)} style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground italic">{message}</p>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
