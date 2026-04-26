"use client";

import { useState, useMemo, useTransition } from "react";
import { ScrollText, Trash } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoansClient } from "./loans-client";
import { LoanRowActions } from "./loan-row-actions";
import { deleteLoanPayment, deleteSettledLoans } from "@/lib/actions/loans";
import type { AccountWithBalance, DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";

// ─── Loan row ─────────────────────────────────────────────────────────────────

function LoanRow({
  loan,
  accounts,
  debtors,
}: {
  loan: LoanWithRemaining;
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
}) {
  const [now] = useState(Date.now);
  const pct = loan.amount > 0 ? Math.min(100, (loan.paid / loan.amount) * 100) : 0;
  const ageMs = now - new Date(loan.date).getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const ageLabel = ageDays >= 30 ? `${Math.floor(ageDays / 30)}mo` : `${ageDays}d`;
  const isOverdue = loan.isActive && loan.expectedBy && new Date(loan.expectedBy) < new Date();

  // Stale: active loan older than 90 days with no payment in the last 90 days
  const lastPaymentMs = loan.payments.length > 0
    ? Math.max(...loan.payments.map((p) => new Date(p.date).getTime()))
    : null;
  const daysSincePayment = lastPaymentMs !== null
    ? Math.floor((now - lastPaymentMs) / (1000 * 60 * 60 * 24))
    : ageDays;
  const isStale = loan.isActive && ageDays > 90 && daysSincePayment > 90;

  return (
    <TableRow className="group/loanrow border-border/50">
      <TableCell className="px-4">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: loan.accountColor ?? "#888" }} />
          <span className="text-muted-foreground text-xs truncate">{loan.accountName}</span>
        </div>
      </TableCell>
      <TableCell className="px-4 text-muted-foreground text-xs">
        {new Date(loan.date).toLocaleDateString("es-CO", { month: "short", day: "numeric", year: "2-digit" })}
      </TableCell>
      <TableCell className="px-4 font-mono text-xs text-muted-foreground">
        {formatCOP(loan.amount)}
      </TableCell>
      <TableCell className="px-4">
        <div className="flex items-center gap-2 min-w-[8rem]">
          <div className="h-1.5 flex-1 rounded-full bg-muted/50 overflow-hidden">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-xs text-muted-foreground w-8 shrink-0 text-right">
            {pct.toFixed(0)}%
          </span>
        </div>
      </TableCell>
      <TableCell className={cn("px-4 font-mono text-sm font-medium text-right", loan.isActive ? "text-foreground" : "text-muted-foreground")}>
        {loan.remaining > 0 ? formatCOP(loan.remaining) : "—"}
      </TableCell>
      <TableCell className={cn("px-4 text-xs text-right hidden md:table-cell", isStale ? "text-warning font-medium" : "text-muted-foreground")}>
        {ageLabel}
      </TableCell>
      <TableCell className="px-4">
        <div className="flex justify-end">
          {loan.isActive ? (
            <span className={cn("rounded-full px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", isOverdue ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning")}>
              {isOverdue ? "Overdue" : "Active"}
            </span>
          ) : (
            <span className="rounded-full bg-success/10 text-success px-1.5 py-0.5 text-xs font-medium whitespace-nowrap">Settled</span>
          )}
        </div>
      </TableCell>
      <TableCell className="px-4 text-xs text-muted-foreground truncate max-w-[10rem] hidden md:table-cell">
        {loan.notes ?? "—"}
      </TableCell>
      <TableCell className="px-4 w-14">
        <div className="flex justify-end opacity-0 group-hover/loanrow:opacity-100 transition-opacity">
          <LoanRowActions loan={loan} accounts={accounts} debtors={debtors} />
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Debtors section ──────────────────────────────────────────────────────────

export function DebtorsSection({
  accounts,
  debtors,
  totalEverLent,
  totalRecovered,
}: {
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  totalEverLent: number;
  totalRecovered: number;
}) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [paymentsDebtor, setPaymentsDebtor] = useState<DebtorWithLoans | null>(null);
  const [deletePaymentPending, startDeletePayment] = useTransition();
  const [clearSettledPending, startClearSettled] = useTransition();

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

  const recoveryPct = totalEverLent > 0 ? (totalRecovered / totalEverLent) * 100 : 0;

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Debtors
        </h2>
        <LoansClient accounts={accounts} debtors={debtors} mode="add-debtor" />
      </div>

      {/* Portfolio stats strip */}
      {debtors.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{formatCOP(totalEverLent)}</span>
            {" "}total lent
          </span>
          <span>
            <span className="font-medium text-success">{formatCOP(totalRecovered)}</span>
            {" "}recovered
          </span>
          <span>
            <span className="font-mono font-medium text-foreground">{recoveryPct.toFixed(1)}%</span>
            {" "}recovery rate
          </span>
        </div>
      )}

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
                  <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 py-3 bg-card">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-medium">{debtor.name}</span>
                      <span className="font-mono text-sm text-muted-foreground whitespace-nowrap">
                        {formatCOP(debtor.totalOwed)}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {debtor.activeLoansCount} active loan{debtor.activeLoansCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs text-muted-foreground"
                        onClick={() => setPaymentsDebtor(debtors.find((d) => d.id === debtor.id) ?? null)}
                      >
                        <ScrollText className="size-3" />
                        Payments
                      </Button>
                      {debtor.loans.filter((l) => !l.isActive).length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
                          disabled={clearSettledPending}
                          onClick={() =>
                            startClearSettled(async () => {
                              await deleteSettledLoans(debtor.id);
                            })
                          }
                        >
                          <Trash className="size-3" />
                          Clear settled ({debtor.loans.filter((l) => !l.isActive).length})
                        </Button>
                      )}
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
                    <div className="border-t border-border">
                      <Table className="table-fixed">
                        <TableHeader>
                          <TableRow className="bg-muted/20 hover:bg-muted/20 border-border/50">
                            <TableHead className="px-4 h-8 w-[130px] text-xs text-muted-foreground">Account</TableHead>
                            <TableHead className="px-4 h-8 w-[95px] text-xs text-muted-foreground">Date</TableHead>
                            <TableHead className="px-4 h-8 w-[110px] text-xs text-muted-foreground">Original</TableHead>
                            <TableHead className="px-4 h-8 w-[155px] text-xs text-muted-foreground">Repaid</TableHead>
                            <TableHead className="px-4 h-8 w-[125px] text-right text-xs text-muted-foreground">Remaining</TableHead>
                            <TableHead className="px-4 h-8 w-[60px] text-right text-xs text-muted-foreground hidden md:table-cell">Age</TableHead>
                            <TableHead className="px-4 h-8 w-[85px] text-right text-xs text-muted-foreground">Status</TableHead>
                            <TableHead className="px-4 h-8 w-[160px] text-xs text-muted-foreground hidden md:table-cell">Notes</TableHead>
                            <TableHead className="px-4 h-8 w-14" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {debtor.loans.map((loan) => (
                            <LoanRow key={loan.id} loan={loan} accounts={accounts} debtors={debtors} />
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {/* Payments log dialog */}
      {(() => {
        const d = paymentsDebtor ? debtors.find((x) => x.id === paymentsDebtor.id) ?? paymentsDebtor : null;
        const allPayments = d
          ? d.loans
              .flatMap((l) =>
                l.payments.map((p) => ({
                  ...p,
                  accountName: l.accountName,
                  accountColor: l.accountColor,
                  loanDate: l.date,
                }))
              )
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          : [];

        return (
          <Dialog open={!!paymentsDebtor} onOpenChange={(o: boolean) => !o && setPaymentsDebtor(null)}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{d?.name} — Payment history</DialogTitle>
              </DialogHeader>
              {allPayments.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <div className="max-h-[60vh] overflow-x-auto overflow-y-auto -mx-6 divide-y divide-border/40">
                  {allPayments.map((p) => (
                    <div key={p.id} className="grid grid-cols-[5rem_6rem_8rem_1fr_1.25rem] items-center gap-x-3 px-6 py-2.5 group/row hover:bg-muted/20">
                      <span className="text-xs text-muted-foreground">
                        {new Date(p.date).toLocaleDateString("es-CO", { month: "short", day: "numeric", year: "2-digit" })}
                      </span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: p.accountColor ?? "#888" }} />
                        <span className="text-xs text-muted-foreground truncate">{p.accountName}</span>
                      </div>
                      <span className="font-mono text-xs font-medium text-success">
                        +{formatCOP(p.amount)}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">{p.notes ?? ""}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5 opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive"
                        disabled={deletePaymentPending}
                        onClick={() => startDeletePayment(async () => { await deleteLoanPayment(p.id); })}
                      >
                        <Trash className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}
    </section>
  );
}
