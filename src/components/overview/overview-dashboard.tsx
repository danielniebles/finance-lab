import Link from "next/link";
import { db } from "@/lib/db";
import { getMonthlyAnalysis } from "@/lib/queries/expenses";
import { getAllInstallments, getMonthSummary, type DueThisMonth } from "@/lib/queries/installments";
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
  fixedActual: number;
  fixedBudget: number;
  savingsRate: number | null;
}

// Variable spending on purpose has NO bar here — it's already the "Variable
// Burn" KPI card above (same variableBurnRate number); showing both was the
// duplicate this panel used to carry (Overview redesign req 3).
function BudgetBarsPanel({
  fixedActual,
  fixedBudget,
  savingsRate,
}: BudgetBarsPanelProps) {
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
        <BudgetBar label="Fixed Costs" valueStr={fixedStr} pct={fixedPct} fillClass={fixedFill} />
        <BudgetBar label="Savings Target" valueStr={savingsStr} pct={savingsPct} fillClass={savingsFill} />
      </CardContent>
    </Card>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, tone, className,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad" | "neutral";
  className?: string;
}) {
  const color =
    tone === "good" ? "text-success" :
    tone === "bad"  ? "text-destructive" :
    "text-foreground";
  return (
    <div className={cn("rounded-xl border border-border bg-muted px-5 py-4 space-y-1", className)}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-lg font-semibold", color)}>{value}</p>
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
      <ArrowRight className="size-3.5" />
    </Link>
  );
}

// ─── Obligations card (merged Loans + Installments) ────────────────────────────
// Liquidity health lives next to Total Balance on the Accounts card now (a
// pill, not a banner) — this card sticks to what its name promises: what's
// outstanding, to how many people, and what's due soon (Overview redesign
// req 1 & 6).

function InstallmentRow({ due, paid }: { due: DueThisMonth; paid: boolean }) {
  const key = `${due.installment.id}-${due.installmentNum}`;
  const Icon = paid ? CheckCircle2 : Circle;
  return (
    <div key={key} className="flex items-center gap-2.5 min-w-0">
      <Icon className={cn("size-5 shrink-0", paid ? "text-success" : "text-muted-foreground/50")} />
      <span className="flex-1 truncate text-sm text-foreground">
        {due.installment.description}
        <span className="ml-1.5 text-xs text-muted-foreground/60">
          #{due.installmentNum}/{due.installment.numInstallments}
        </span>
      </span>
      <span className="font-mono text-sm tabular-nums shrink-0 text-foreground">
        {formatCOP(due.amount)}
      </span>
    </div>
  );
}

function ObligationsCard({
  inLoans,
  activeDebtors,
  unpaid,
  paid,
  totalDue,
}: {
  inLoans: number;
  activeDebtors: number;
  unpaid: DueThisMonth[];
  paid: DueThisMonth[];
  totalDue: number;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="px-5 py-4 border-b border-border/60">
        <CardTitle className="text-base font-semibold">Obligations</CardTitle>
        <CardAction>
          <div className="flex items-center gap-3">
            <ViewLink href="/loans" label="Loans" />
            <ViewLink href="/installments" label="Installments" />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="px-5 py-4 space-y-4">
        {/* Outstanding / Debtors */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Outstanding</p>
            <p className="font-mono text-2xl font-semibold mt-1">{formatCOP(inLoans)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Debtors</p>
            <p className="font-mono text-2xl font-semibold mt-1">{activeDebtors}</p>
          </div>
        </div>

        <div className="border-t border-border/60" />

        {/* Upcoming installments */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Upcoming Installments
            </p>
            {unpaid.length > 0 || paid.length > 0 ? (
              totalDue > 0 ? (
                <span className="font-mono text-xs text-destructive tabular-nums shrink-0">
                  {formatCOP(totalDue)} remaining
                </span>
              ) : (
                <span className="text-xs text-success shrink-0">All paid ✓</span>
              )
            ) : null}
          </div>

          {unpaid.length === 0 && paid.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due this month.</p>
          ) : (
            <>
              {unpaid.length > 0 && (
                <div className="space-y-2">
                  {unpaid.map((d) => (
                    <InstallmentRow key={`${d.installment.id}-${d.installmentNum}`} due={d} paid={false} />
                  ))}
                </div>
              )}
              {paid.length > 0 && (
                <div className="opacity-40 mt-3 space-y-2">
                  {paid.map((d) => (
                    <InstallmentRow key={`${d.installment.id}-${d.installmentNum}`} due={d} paid={true} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
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

      {/* KPI strip — Income/Expenses (long COP values) are paired with their
          related percentage card and span more of the row on mobile, so a
          10-11 digit value doesn't sit cramped in the same width as a short
          "12.3%" (mirrors the variable-width KpiCard strip in Loans). */}
      <div className="grid grid-cols-5 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Income"
          value={formatCOP(analysis.totalIncome)}
          tone="neutral"
          className="col-span-3 lg:col-span-1"
        />
        <KpiCard
          label="Savings Rate"
          value={analysis.savingsRate !== null ? `${analysis.savingsRate.toFixed(1)}%` : "—"}
          sub={formatCOP(analysis.realSavings)}
          tone={savingsTone}
          className="col-span-2 lg:col-span-1"
        />
        <KpiCard
          label="Expenses"
          value={formatCOP(analysis.totalExpenses)}
          sub={`budget ${formatCOP(analysis.totalBudget)}`}
          tone={analysis.totalExpenses > analysis.totalBudget ? "bad" : "neutral"}
          className="col-span-3 lg:col-span-1"
        />
        <KpiCard
          label="Variable Burn"
          value={analysis.variableBurnRate !== null ? `${analysis.variableBurnRate.toFixed(1)}%` : "—"}
          sub="of variable budget"
          tone={burnTone}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {/* Main content grid */}
      <div className="grid gap-4 lg:grid-cols-12">

        {/* Left column: donut (+ per-category status) + budget bars */}
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
                  percentUsed: c.percentUsed,
                  severity: c.severity,
                  note: c.note,
                }))}
                totalExpenses={analysis.totalExpenses}
              />
            </CardContent>
          </Card>

          <BudgetBarsPanel
            fixedActual={analysis.fixedActual}
            fixedBudget={analysis.fixedBudget}
            savingsRate={analysis.savingsRate}
          />
        </div>

        {/* Right column: Obligations (Loans + Installments merged) */}
        <div className="lg:col-span-5 space-y-4">
          <ObligationsCard
            inLoans={loans.inLoans}
            activeDebtors={activeDebtors}
            unpaid={unpaid}
            paid={paid}
            totalDue={monthSummary.totalDue}
          />
        </div>
      </div>
    </div>
  );
}
