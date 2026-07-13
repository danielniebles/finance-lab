"use client";

import { useState, useMemo, useTransition } from "react";
import { ScrollText, Trash, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoansClient } from "./loans-client";
import { LoanRowActions } from "./loan-row-actions";
import { deleteLoanPayment, deleteSettledLoans } from "@/lib/actions/loans";
import type { AccountWithBalance, DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";
import { MASK } from "./lib/constants";

// ─── Loan row helpers ─────────────────────────────────────────────────────────

type LoanMeta = {
  pct: number;
  ageLabel: string;
  isOverdue: boolean;
  isStale: boolean;
};

function computeLoanMeta(loan: LoanWithRemaining): LoanMeta {
  const now = Date.now();
  const pct = loan.amount > 0 ? Math.min(100, (loan.paid / loan.amount) * 100) : 0;
  const ageMs = now - new Date(loan.date).getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const ageLabel = ageDays >= 30 ? `${Math.floor(ageDays / 30)}mo` : `${ageDays}d`;
  const isOverdue = loan.isActive && !!loan.expectedBy && new Date(loan.expectedBy) < new Date();
  const lastPaymentMs = loan.payments.length > 0
    ? Math.max(...loan.payments.map((p) => new Date(p.date).getTime()))
    : null;
  const daysSincePayment = lastPaymentMs !== null
    ? Math.floor((now - lastPaymentMs) / (1000 * 60 * 60 * 24))
    : ageDays;
  const isStale = loan.isActive && ageDays > 90 && daysSincePayment > 90;
  return { pct, ageLabel, isOverdue, isStale };
}

function maskStr(value: string, masked: boolean | undefined): string {
  return masked ? MASK : value;
}

function LoanStatusBadge({ isActive, isOverdue }: { isActive: boolean; isOverdue: boolean }) {
  if (!isActive) {
    return (
      <span className="rounded-full bg-success/10 text-success px-1.5 py-0.5 text-xs font-medium whitespace-nowrap">
        Settled
      </span>
    );
  }
  return (
    <span className={cn("rounded-full px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", isOverdue ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning")}>
      {isOverdue ? "Overdue" : "Active"}
    </span>
  );
}

// ─── Loan row ─────────────────────────────────────────────────────────────────

function LoanRow({
  loan,
  accounts,
  debtors,
  masked,
}: {
  loan: LoanWithRemaining;
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  masked?: boolean;
}) {
  const { pct, ageLabel, isOverdue, isStale } = computeLoanMeta(loan);

  return (
    <TableRow className="group/loanrow border-border/50">
      <TableCell className="px-2">
        <span
          className="mx-auto block size-2.5 rounded-full"
          style={{ backgroundColor: loan.accountColor ?? "#888" }}
          title={maskStr(loan.accountName, masked)}
        />
      </TableCell>
      <TableCell className="px-4 text-muted-foreground text-xs">
        {new Date(loan.date).toLocaleDateString("es-CO", { month: "short", day: "numeric", year: "2-digit" })}
      </TableCell>
      <TableCell className="px-4 font-mono text-xs text-muted-foreground">
        {maskStr(formatCOP(loan.amount), masked)}
      </TableCell>
      <TableCell className="px-4">
        {masked ? (
          <div className="h-1.5 flex-1 rounded-full bg-muted/30" />
        ) : (
          <div className="flex items-center gap-2 min-w-32">
            <div className="h-1.5 flex-1 rounded-full bg-muted/50 overflow-hidden">
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="font-mono text-xs text-muted-foreground w-8 shrink-0 text-right">
              {pct.toFixed(0)}%
            </span>
          </div>
        )}
      </TableCell>
      <TableCell className={cn("px-4 font-mono text-sm font-medium text-right", masked ? "text-muted-foreground" : loan.isActive ? "text-foreground" : "text-muted-foreground")}>
        {maskStr(loan.remaining > 0 ? formatCOP(loan.remaining) : "—", masked)}
      </TableCell>
      <TableCell className={cn("px-4 text-xs text-right hidden md:table-cell", isStale ? "text-warning font-medium" : "text-muted-foreground")}>
        {ageLabel}
      </TableCell>
      <TableCell className="px-4">
        <div className="flex justify-end">
          <LoanStatusBadge isActive={loan.isActive} isOverdue={isOverdue} />
        </div>
      </TableCell>
      <TableCell className="px-4 text-xs text-muted-foreground truncate max-w-40 hidden md:table-cell">
        {loan.notes ?? "—"}
      </TableCell>
      <TableCell className="px-4 w-14">
        {!masked && (
          <div className="flex justify-end opacity-0 group-hover/loanrow:opacity-100 transition-opacity">
            <LoanRowActions loan={loan} accounts={accounts} debtors={debtors} />
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Payments log helpers ──────────────────────────────────────────────────────

type Payment = {
  id: string;
  amount: number;
  date: Date;
  notes: string | null;
  accountName: string;
  accountColor: string | null;
  loanDate: Date;
};

function buildPaymentsLog(debtor: DebtorWithLoans): Payment[] {
  return debtor.loans
    .flatMap((l) =>
      l.payments.map((p) => ({
        ...p,
        accountName: l.accountName,
        accountColor: l.accountColor,
        loanDate: l.date,
      }))
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── Debtor payments dialog ────────────────────────────────────────────────────

function DebtorPaymentsDialog({
  debtor,
  onClose,
  deletePaymentPending,
  startDeletePayment,
}: {
  debtor: DebtorWithLoans | null;
  onClose: () => void;
  deletePaymentPending: boolean;
  startDeletePayment: (fn: () => Promise<void>) => void;
}) {
  const allPayments = debtor ? buildPaymentsLog(debtor) : [];

  return (
    <Dialog open={!!debtor} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{debtor?.name} — Payment history</DialogTitle>
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
                  <Trash className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Debtor header helpers ────────────────────────────────────────────────────

function PrivacyRevealButton({ isRevealed, onReveal }: { isRevealed: boolean; onReveal: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-7 gap-1 text-xs", isRevealed ? "text-primary" : "text-muted-foreground")}
      onClick={onReveal}
      title={isRevealed ? "Hide amounts" : "Show amounts"}
    >
      {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      {isRevealed ? "Hide" : "Show"}
    </Button>
  );
}

function DebtorActionButtons({
  debtor,
  accounts,
  debtors,
  privacyMode,
  isRevealed,
  visible,
  settledCount,
  clearSettledPending,
  onReveal,
  onShowPayments,
  onClearSettled,
}: {
  debtor: DebtorWithLoans;
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  privacyMode: boolean;
  isRevealed: boolean;
  visible: boolean;
  settledCount: number;
  clearSettledPending: boolean;
  onReveal: () => void;
  onShowPayments: () => void;
  onClearSettled: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {privacyMode && <PrivacyRevealButton isRevealed={isRevealed} onReveal={onReveal} />}
      {visible && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={onShowPayments}
        >
          <ScrollText className="size-3.5" />
          Payments
        </Button>
      )}
      {visible && settledCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
          disabled={clearSettledPending}
          onClick={onClearSettled}
        >
          <Trash className="size-3.5" />
          Clear settled ({settledCount})
        </Button>
      )}
      {visible && debtor.totalOwed > 0 && (
        <LoansClient accounts={accounts} debtors={debtors} mode="pay-button" debtorId={debtor.id} />
      )}
      {visible && (
        <LoansClient accounts={accounts} debtors={debtors} mode="add-loan-button" debtorId={debtor.id} />
      )}
    </div>
  );
}

// ─── Debtor header ─────────────────────────────────────────────────────────────

function DebtorHeader({
  debtor,
  accounts,
  debtors,
  privacyMode,
  isRevealed,
  clearSettledPending,
  onReveal,
  onShowPayments,
  onClearSettled,
}: {
  debtor: DebtorWithLoans;
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  privacyMode: boolean;
  isRevealed: boolean;
  clearSettledPending: boolean;
  onReveal: () => void;
  onShowPayments: () => void;
  onClearSettled: () => void;
}) {
  const visible = !privacyMode || isRevealed;
  const settledCount = debtor.loans.filter((l) => !l.isActive).length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 py-3 bg-card">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-medium">{debtor.name}</span>
        <span className="font-mono text-sm text-muted-foreground whitespace-nowrap">
          {privacyMode && !isRevealed ? MASK : formatCOP(debtor.totalOwed)}
        </span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {debtor.activeLoansCount} active loan{debtor.activeLoansCount !== 1 ? "s" : ""}
        </span>
      </div>
      <DebtorActionButtons
        debtor={debtor}
        accounts={accounts}
        debtors={debtors}
        privacyMode={privacyMode}
        isRevealed={isRevealed}
        visible={visible}
        settledCount={settledCount}
        clearSettledPending={clearSettledPending}
        onReveal={onReveal}
        onShowPayments={onShowPayments}
        onClearSettled={onClearSettled}
      />
    </div>
  );
}

// ─── Debtor account filter ─────────────────────────────────────────────────────

function DebtorAccountFilter({
  debtors,
  accounts,
  children,
}: {
  debtors: DebtorWithLoans[];
  accounts: AccountWithBalance[];
  children: (filtered: DebtorWithLoans[]) => React.ReactNode;
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
    <>
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
      {children(filteredDebtors)}
    </>
  );
}

// ─── Debtors section ──────────────────────────────────────────────────────────

export function DebtorsSection({
  accounts,
  debtors,
  totalEverLent,
  totalRecovered,
  privacyMode,
  revealedDebtorId,
  onReveal,
}: {
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  totalEverLent: number;
  totalRecovered: number;
  privacyMode: boolean;
  revealedDebtorId: string | null;
  onReveal: (id: string) => void;
}) {
  const [paymentsDebtor, setPaymentsDebtor] = useState<DebtorWithLoans | null>(null);
  const [deletePaymentPending, startDeletePayment] = useTransition();
  const [clearSettledPending, startClearSettled] = useTransition();

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
            <span className="font-medium text-foreground">{privacyMode ? MASK : formatCOP(totalEverLent)}</span>
            {" "}total lent
          </span>
          <span>
            <span className="font-medium text-success">{privacyMode ? MASK : formatCOP(totalRecovered)}</span>
            {" "}recovered
          </span>
          <span>
            <span className="font-mono font-medium text-foreground">{privacyMode ? MASK : `${recoveryPct.toFixed(1)}%`}</span>
            {" "}recovery rate
          </span>
        </div>
      )}

      {debtors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No debtors yet.</p>
      ) : (
        <DebtorAccountFilter debtors={debtors} accounts={accounts}>
          {(filteredDebtors) => (
            filteredDebtors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No loans from this account.</p>
            ) : (
              <div className="space-y-2">
                {filteredDebtors.map((debtor) => (
                  <div key={debtor.id} className="rounded-xl border border-border overflow-hidden">
                    <DebtorHeader
                      debtor={debtor}
                      accounts={accounts}
                      debtors={debtors}
                      privacyMode={privacyMode}
                      isRevealed={revealedDebtorId === debtor.id}
                      clearSettledPending={clearSettledPending}
                      onReveal={() => onReveal(debtor.id)}
                      onShowPayments={() => setPaymentsDebtor(debtors.find((d) => d.id === debtor.id) ?? null)}
                      onClearSettled={() => startClearSettled(async () => { await deleteSettledLoans(debtor.id); })}
                    />
                    {debtor.loans.length > 0 && (
                      <div className="border-t border-border">
                        <Table className="table-fixed">
                          <TableHeader>
                            <TableRow className="bg-muted/20 hover:bg-muted/20 border-border/50">
                              <TableHead className="px-2 h-8 w-10 text-xs text-muted-foreground">Account</TableHead>
                              <TableHead className="px-4 h-8 w-30 text-xs text-muted-foreground">Date</TableHead>
                              <TableHead className="px-4 h-8 w-35 text-xs text-muted-foreground">Original</TableHead>
                              <TableHead className="px-4 h-8 w-33.75 text-xs text-muted-foreground">Repaid</TableHead>
                              <TableHead className="px-4 h-8 w-31.25 text-right text-xs text-muted-foreground">Remaining</TableHead>
                              <TableHead className="px-4 h-8 w-15 text-right text-xs text-muted-foreground hidden md:table-cell">Age</TableHead>
                              <TableHead className="px-4 h-8 w-21.25 text-right text-xs text-muted-foreground">Status</TableHead>
                              <TableHead className="px-4 h-8 w-40 text-xs text-muted-foreground hidden md:table-cell">Notes</TableHead>
                              <TableHead className="px-4 h-8 w-14" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {debtor.loans.map((loan) => (
                              <LoanRow
                                key={loan.id}
                                loan={loan}
                                accounts={accounts}
                                debtors={debtors}
                                masked={privacyMode && debtor.id !== revealedDebtorId}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </DebtorAccountFilter>
      )}

      {/* Payments log dialog */}
      <DebtorPaymentsDialog
        debtor={paymentsDebtor ? (debtors.find((d) => d.id === paymentsDebtor.id) ?? paymentsDebtor) : null}
        onClose={() => setPaymentsDebtor(null)}
        deletePaymentPending={deletePaymentPending}
        startDeletePayment={startDeletePayment}
      />
    </section>
  );
}
