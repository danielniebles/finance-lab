import { getLoansOverview } from "@/lib/queries/loans";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { LoansClient } from "./loans-client";

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

// ─── Account card ─────────────────────────────────────────────────────────────

function AccountTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    BANK:    "bg-blue-500/10 text-blue-400",
    DIGITAL: "bg-violet-500/10 text-violet-400",
    PENSION: "bg-amber-500/10 text-amber-400",
  };
  const label: Record<string, string> = { BANK: "Bank", DIGITAL: "Digital", PENSION: "AFP" };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", map[type] ?? map.BANK)}>
      {label[type] ?? type}
    </span>
  );
}

function AccountCard({ account }: { account: Awaited<ReturnType<typeof getLoansOverview>>["accounts"][0] }) {
  const isNegative = account.balance < 0;
  const isExcluded = !account.includeInAvailable;
  return (
    <div className={cn("rounded-xl border bg-card p-4 space-y-3", isExcluded && "opacity-60")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="size-3 rounded-full shrink-0"
            style={{ backgroundColor: account.color ?? "#888" }}
          />
          <span className="font-medium text-sm">{account.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AccountTypeBadge type={account.accountType} />
          {isExcluded && (
            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">excluded</span>
          )}
        </div>
      </div>
      <p className={cn("font-mono text-lg font-semibold", isNegative ? "text-red-400" : "text-foreground")}>
        {formatCOP(account.balance)}
      </p>
    </div>
  );
}

// ─── Debtor table (rendered server-side, interactions in client) ───────────────

function LoanRow({ loan }: { loan: Awaited<ReturnType<typeof getLoansOverview>>["debtors"][0]["loans"][0] }) {
  const pct = loan.amount > 0 ? Math.min(100, (loan.paid / loan.amount) * 100) : 0;
  const ageMs = Date.now() - new Date(loan.date).getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const ageLabel = ageDays >= 30 ? `${Math.floor(ageDays / 30)}mo` : `${ageDays}d`;
  const isOverdue = loan.isActive && loan.expectedBy && new Date(loan.expectedBy) < new Date();

  return (
    <div className="flex items-center gap-4 py-2.5 px-4 text-sm hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-1.5 w-28 shrink-0">
        <span className="size-2 rounded-full" style={{ backgroundColor: loan.accountColor ?? "#888" }} />
        <span className="text-muted-foreground text-xs">{loan.accountName}</span>
      </div>
      <span className="text-muted-foreground text-xs w-20 shrink-0">
        {new Date(loan.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
      </span>
      <span className="font-mono text-xs text-muted-foreground w-24 shrink-0">{formatCOP(loan.amount)}</span>
      <div className="flex-1 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-muted/50 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-xs text-muted-foreground w-10 shrink-0 text-right">
          {pct.toFixed(0)}%
        </span>
      </div>
      <span className={cn("font-mono text-sm font-medium w-28 shrink-0 text-right", loan.isActive ? "text-foreground" : "text-muted-foreground")}>
        {loan.remaining > 0 ? formatCOP(loan.remaining) : "—"}
      </span>
      <div className="flex items-center gap-1.5 w-20 shrink-0 justify-end">
        <span className="text-xs text-muted-foreground">{ageLabel}</span>
        {loan.isActive ? (
          <span className={cn("rounded-full px-1.5 py-0.5 text-xs font-medium", isOverdue ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400")}>
            {isOverdue ? "Overdue" : "Active"}
          </span>
        ) : (
          <span className="rounded-full bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 text-xs font-medium">Settled</span>
        )}
      </div>
      {loan.notes && (
        <span className="text-xs text-muted-foreground truncate max-w-32">{loan.notes}</span>
      )}
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
                    <div className="flex items-center gap-4 px-4 py-1.5 bg-muted/20">
                      <span className="text-xs text-muted-foreground w-28">Account</span>
                      <span className="text-xs text-muted-foreground w-20">Date</span>
                      <span className="text-xs text-muted-foreground w-24">Original</span>
                      <span className="text-xs text-muted-foreground flex-1">Repaid</span>
                      <span className="text-xs text-muted-foreground w-28 text-right">Remaining</span>
                      <span className="text-xs text-muted-foreground w-20 text-right">Status</span>
                    </div>
                    {debtor.loans.map((loan) => (
                      <LoanRow key={loan.id} loan={loan} />
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
