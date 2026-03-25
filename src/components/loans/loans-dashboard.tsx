import { getLoansOverview } from "@/lib/queries/loans";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { LoansClient } from "./loans-client";
import { AccountCard } from "./account-card";
import { LoanRowActions } from "./loan-row-actions";
import type { AccountWithBalance, DebtorWithLoans } from "@/lib/queries/loans";

// ─── KPI strip ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, highlight, warn,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "good" | "bad" | "neutral";
  warn?: boolean;
}) {
  const color = highlight === "good" ? "text-emerald-400" : highlight === "bad" ? "text-red-400" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-end gap-2">
        <p className={cn("font-mono text-xl font-semibold", color)}>{value}</p>
        {warn && <AlertTriangle className="size-4 text-amber-400 mb-0.5 shrink-0" />}
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Debtor table (rendered server-side, interactions in client) ───────────────

function LoanRow({
  loan,
  accounts,
  debtors,
}: {
  loan: Awaited<ReturnType<typeof getLoansOverview>>["debtors"][0]["loans"][0];
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
}) {
  const pct = loan.amount > 0 ? Math.min(100, (loan.paid / loan.amount) * 100) : 0;
  const ageMs = Date.now() - new Date(loan.date).getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const ageLabel = ageDays >= 30 ? `${Math.floor(ageDays / 30)}mo` : `${ageDays}d`;
  const isOverdue = loan.isActive && loan.expectedBy && new Date(loan.expectedBy) < new Date();

  return (
    <div className="grid grid-cols-[1.5fr_1fr_1.2fr_2fr_1.4fr_0.5fr_0.9fr_2fr_3.5rem] items-center gap-x-4 py-2.5 px-4 text-sm hover:bg-muted/20 transition-colors group/loanrow">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: loan.accountColor ?? "#888" }} />
        <span className="text-muted-foreground text-xs truncate">{loan.accountName}</span>
      </div>
      <span className="text-muted-foreground text-xs">
        {new Date(loan.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
      </span>
      <span className="font-mono text-xs text-muted-foreground">{formatCOP(loan.amount)}</span>
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-1.5 flex-1 rounded-full bg-muted/50 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-xs text-muted-foreground w-8 shrink-0 text-right">
          {pct.toFixed(0)}%
        </span>
      </div>
      <span className={cn("font-mono text-sm font-medium text-right", loan.isActive ? "text-foreground" : "text-muted-foreground")}>
        {loan.remaining > 0 ? formatCOP(loan.remaining) : "—"}
      </span>
      <span className="text-xs text-muted-foreground text-right">{ageLabel}</span>
      <div className="flex justify-end">
        {loan.isActive ? (
          <span className={cn("rounded-full px-1.5 py-0.5 text-xs font-medium", isOverdue ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400")}>
            {isOverdue ? "Overdue" : "Active"}
          </span>
        ) : (
          <span className="rounded-full bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 text-xs font-medium">Settled</span>
        )}
      </div>
      <span className="text-xs text-muted-foreground truncate min-w-0">{loan.notes ?? "—"}</span>
      <div className="flex justify-end opacity-0 group-hover/loanrow:opacity-100 transition-opacity">
        <LoanRowActions loan={loan} accounts={accounts} debtors={debtors} />
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export async function LoansDashboard() {
  const data = await getLoansOverview();
  const liquidityWarn = data.liquidityRatio !== null && data.liquidityRatio < 10;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Savings & Loans</h1>
          <p className="text-sm text-muted-foreground">Account balances and outstanding loans</p>
        </div>
        <LoansClient accounts={data.accounts} debtors={data.debtors} mode="action-bar" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Available"
          value={formatCOP(data.available)}
          sub="liquid accounts"
          highlight={data.available >= 0 ? "neutral" : "bad"}
        />
        <KpiCard
          label="In Loans"
          value={formatCOP(data.inLoans)}
          sub={`${data.debtors.filter((d) => d.totalOwed > 0).length} active debtors`}
        />
        <KpiCard
          label="Total Savings"
          value={formatCOP(data.totalSavings)}
          sub="available + in loans"
          highlight="neutral"
        />
        <KpiCard
          label="Liquidity"
          value={data.liquidityRatio !== null ? `${data.liquidityRatio.toFixed(1)}%` : "—"}
          sub="available / total"
          highlight={liquidityWarn ? "bad" : "neutral"}
          warn={liquidityWarn}
        />
      </div>

      {/* Accounts grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Accounts
          </h2>
          <LoansClient accounts={data.accounts} debtors={data.debtors} mode="add-account" />
        </div>
        {data.accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.accounts.map((a) => (
              <AccountCard key={a.id} account={a} />
            ))}
          </div>
        )}
      </section>

      {/* Debtors */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Debtors
          </h2>
          <LoansClient accounts={data.accounts} debtors={data.debtors} mode="add-debtor" />
        </div>
        {data.debtors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No debtors yet.</p>
        ) : (
          <div className="space-y-2">
            {data.debtors.map((debtor) => (
              <div key={debtor.id} className="rounded-xl border border-border overflow-hidden">
                {/* Debtor header */}
                <div className="flex items-center justify-between px-4 py-3 bg-card">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{debtor.name}</span>
                    <span className="font-mono text-sm text-muted-foreground">
                      {formatCOP(debtor.totalOwed)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {debtor.activeLoansCount} active loan{debtor.activeLoansCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {debtor.totalOwed > 0 && (
                      <LoansClient
                        accounts={data.accounts}
                        debtors={data.debtors}
                        mode="pay-button"
                        debtorId={debtor.id}
                      />
                    )}
                    <LoansClient
                      accounts={data.accounts}
                      debtors={data.debtors}
                      mode="add-loan-button"
                      debtorId={debtor.id}
                    />
                  </div>
                </div>

                {/* Loan rows */}
                {debtor.loans.length > 0 && (
                  <div className="border-t border-border divide-y divide-border/50">
                    <div className="grid grid-cols-[1.5fr_1fr_1.2fr_2fr_1.4fr_0.5fr_0.9fr_2fr_3.5rem] items-center gap-x-4 px-4 py-1.5 bg-muted/20">
                      <span className="text-xs text-muted-foreground">Account</span>
                      <span className="text-xs text-muted-foreground">Date</span>
                      <span className="text-xs text-muted-foreground">Original</span>
                      <span className="text-xs text-muted-foreground">Repaid</span>
                      <span className="text-xs text-muted-foreground text-right">Remaining</span>
                      <span className="text-xs text-muted-foreground text-right">Age</span>
                      <span className="text-xs text-muted-foreground text-right">Status</span>
                      <span className="text-xs text-muted-foreground">Notes</span>
                      <span />
                    </div>
                    {debtor.loans.map((loan) => (
                      <LoanRow key={loan.id} loan={loan} accounts={data.accounts} debtors={data.debtors} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
