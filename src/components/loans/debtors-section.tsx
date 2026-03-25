"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/format";
import { LoansClient } from "./loans-client";
import { LoanRowActions } from "./loan-row-actions";
import type { AccountWithBalance, DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";

// ─── Loan row ─────────────────────────────────────────────────────────────────

const COL = "grid-cols-[1.5fr_1fr_1.2fr_2fr_1.4fr_0.5fr_0.9fr_2fr_3.5rem]";

function LoanRow({
  loan,
  accounts,
  debtors,
}: {
  loan: LoanWithRemaining;
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
}) {
  const pct = loan.amount > 0 ? Math.min(100, (loan.paid / loan.amount) * 100) : 0;
  const ageMs = Date.now() - new Date(loan.date).getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const ageLabel = ageDays >= 30 ? `${Math.floor(ageDays / 30)}mo` : `${ageDays}d`;
  const isOverdue = loan.isActive && loan.expectedBy && new Date(loan.expectedBy) < new Date();

  return (
    <div className={cn("grid items-center gap-x-4 py-2.5 px-4 text-sm hover:bg-muted/20 transition-colors group/loanrow", COL)}>
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

// ─── Debtors section ──────────────────────────────────────────────────────────

export function DebtorsSection({
  accounts,
  debtors,
}: {
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
}) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const filteredDebtors = useMemo(() => {
    if (!selectedAccountId) return debtors;
    return debtors
      .map((d) => {
        const loans = d.loans.filter((l) => l.accountId === selectedAccountId);
        const totalOwed = loans.reduce((s, l) => s + l.remaining, 0);
        const activeLoansCount = loans.filter((l) => l.isActive).length;
        return { ...d, loans, totalOwed, activeLoansCount };
      })
      .filter((d) => d.loans.length > 0);
  }, [debtors, selectedAccountId]);

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Debtors
        </h2>
        <LoansClient accounts={accounts} debtors={debtors} mode="add-debtor" />
      </div>

      {debtors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No debtors yet.</p>
      ) : (
        <>
          {/* Account filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedAccountId(null)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                selectedAccountId === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              All
            </button>
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedAccountId(a.id === selectedAccountId ? null : a.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  selectedAccountId === a.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: a.color ?? "#888" }} />
                {a.name}
              </button>
            ))}
          </div>

          {/* Debtor blocks */}
          {filteredDebtors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No loans from this account.</p>
          ) : (
            <div className="space-y-2">
              {filteredDebtors.map((debtor) => (
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
                          accounts={accounts}
                          debtors={debtors}
                          mode="pay-button"
                          debtorId={debtor.id}
                        />
                      )}
                      <LoansClient
                        accounts={accounts}
                        debtors={debtors}
                        mode="add-loan-button"
                        debtorId={debtor.id}
                      />
                    </div>
                  </div>

                  {/* Loan rows */}
                  {debtor.loans.length > 0 && (
                    <div className="border-t border-border divide-y divide-border/50">
                      <div className={cn("grid items-center gap-x-4 px-4 py-1.5 bg-muted/20", COL)}>
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
                        <LoanRow key={loan.id} loan={loan} accounts={accounts} debtors={debtors} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
