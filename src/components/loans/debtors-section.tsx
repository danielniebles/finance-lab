"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sortDebtors } from "@/lib/loan-display";
import { cn } from "@/lib/utils";
import type { AccountWithBalance, DebtorWithLoans } from "@/lib/queries/loans";
import { LoansClient } from "./loans-client";
import { DebtorAccountFilter } from "./debtors/account-filter";
import { DebtorCard } from "./debtors/debtor-card";
import { DebtorPaymentsDialog } from "./debtors/payments-dialog";
import { RecoveryCard } from "./debtors/recovery-card";

function ShowSettledToggle({
  settledCount,
  showSettled,
  onToggle,
}: {
  settledCount: number;
  showSettled: boolean;
  onToggle: () => void;
}) {
  if (settledCount === 0) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-7 gap-1 text-xs", showSettled ? "text-primary" : "text-muted-foreground")}
      onClick={onToggle}
    >
      {showSettled ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      {showSettled ? "Hide settled" : `Show settled (${settledCount})`}
    </Button>
  );
}

function DebtorList({
  filtered,
  accounts,
  debtors,
  privacyMode,
  revealedDebtorId,
  showSettled,
  onReveal,
  onShowPayments,
}: {
  filtered: DebtorWithLoans[];
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  privacyMode: boolean;
  revealedDebtorId: string | null;
  showSettled: boolean;
  onReveal: (id: string) => void;
  onShowPayments: (id: string) => void;
}) {
  if (filtered.length === 0) return <p className="text-sm text-muted-foreground">No loans from this account.</p>;
  return (
    <div className="flex flex-col gap-3">
      {sortDebtors(filtered).map((debtor, i) => (
        <DebtorCard
          key={debtor.id}
          debtor={debtor}
          accounts={accounts}
          debtors={debtors}
          privacyMode={privacyMode}
          revealedDebtorId={revealedDebtorId}
          showSettled={showSettled}
          // Only the biggest open balance starts expanded; the rest are one tap away.
          defaultOpen={i === 0 && debtor.totalOwed > 0}
          onReveal={() => onReveal(debtor.id)}
          onShowPayments={() => onShowPayments(debtor.id)}
        />
      ))}
    </div>
  );
}

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
  const [paymentsDebtorId, setPaymentsDebtorId] = useState<string | null>(null);
  const [deletePaymentPending, startDeletePayment] = useTransition();
  const [showSettled, setShowSettled] = useState(false);

  const settledCount = debtors.reduce((s, d) => s + d.loans.filter((l) => !l.isActive).length, 0);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">Debtors</h2>
        <div className="flex items-center gap-2">
          <ShowSettledToggle settledCount={settledCount} showSettled={showSettled} onToggle={() => setShowSettled((v) => !v)} />
          <LoansClient accounts={accounts} debtors={debtors} mode="add-debtor" />
        </div>
      </div>

      {debtors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No debtors yet.</p>
      ) : (
        <>
          <RecoveryCard totalEverLent={totalEverLent} totalRecovered={totalRecovered} masked={privacyMode} />
          <DebtorAccountFilter debtors={debtors} accounts={accounts}>
            {(filtered) => (
              <DebtorList
                filtered={filtered}
                accounts={accounts}
                debtors={debtors}
                privacyMode={privacyMode}
                revealedDebtorId={revealedDebtorId}
                showSettled={showSettled}
                onReveal={onReveal}
                onShowPayments={setPaymentsDebtorId}
              />
            )}
          </DebtorAccountFilter>
        </>
      )}

      <DebtorPaymentsDialog
        debtor={debtors.find((d) => d.id === paymentsDebtorId) ?? null}
        onClose={() => setPaymentsDebtorId(null)}
        deletePaymentPending={deletePaymentPending}
        startDeletePayment={startDeletePayment}
      />
    </section>
  );
}
