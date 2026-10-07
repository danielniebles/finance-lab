"use client";

import { ChevronDown, Eye, EyeOff, ScrollText } from "lucide-react";
import { Money } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { debtorSubtitle, initials } from "@/lib/loan-display";
import { cn } from "@/lib/utils";
import type { AccountWithBalance, DebtorWithLoans } from "@/lib/queries/loans";
import { LoansClient } from "../loans-client";
import { MASK } from "../lib/constants";
import { LoanList } from "./loan-list";
import { ShareDebtorButton } from "./share-debtor-button";

type Shared = {
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
};

function DebtorActions({
  debtor,
  accounts,
  debtors,
  privacyMode,
  isRevealed,
  onReveal,
  onShowPayments,
}: Shared & {
  debtor: DebtorWithLoans;
  privacyMode: boolean;
  isRevealed: boolean;
  onReveal: () => void;
  onShowPayments: () => void;
}) {
  const visible = !privacyMode || isRevealed;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {privacyMode && (
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 gap-1 text-xs", isRevealed ? "text-primary" : "text-muted-foreground")}
          onClick={onReveal}
        >
          {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {isRevealed ? "Hide" : "Show"}
        </Button>
      )}
      {visible && (
        <>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={onShowPayments}>
            <ScrollText className="size-3.5" />
            Payments
          </Button>
          {debtor.totalOwed > 0 && (
            <>
              <ShareDebtorButton debtor={debtor} />
              <LoansClient accounts={accounts} debtors={debtors} mode="pay-button" debtorId={debtor.id} />
            </>
          )}
          <LoansClient accounts={accounts} debtors={debtors} mode="add-loan-button" debtorId={debtor.id} />
        </>
      )}
    </div>
  );
}

function DebtorTrigger({ debtor, masked }: { debtor: DebtorWithLoans; masked: boolean }) {
  const owes = debtor.totalOwed > 0;
  return (
    <CollapsibleTrigger
      className="group flex min-w-0 flex-1 basis-64 items-center gap-3 text-left"
      render={<button type="button" />}
    >
      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
      <span
        aria-hidden
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          owes ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {initials(debtor.name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{debtor.name}</span>
        <span className="text-xs text-muted-foreground">{debtorSubtitle(debtor)}</span>
      </span>
      {masked ? (
        <span className="font-mono text-lg text-muted-foreground">{MASK}</span>
      ) : (
        <Money
          value={debtor.totalOwed}
          className={cn("shrink-0 text-lg font-semibold", !owes && "text-muted-foreground")}
        />
      )}
    </CollapsibleTrigger>
  );
}

export function DebtorCard({
  debtor,
  accounts,
  debtors,
  privacyMode,
  revealedDebtorId,
  showSettled,
  defaultOpen,
  onReveal,
  onShowPayments,
}: Shared & {
  debtor: DebtorWithLoans;
  privacyMode: boolean;
  revealedDebtorId: string | null;
  showSettled: boolean;
  defaultOpen: boolean;
  onReveal: () => void;
  onShowPayments: () => void;
}) {
  const isRevealed = revealedDebtorId === debtor.id;
  const masked = privacyMode && !isRevealed;
  const loans = showSettled ? debtor.loans : debtor.loans.filter((l) => l.isActive);

  return (
    <Collapsible defaultOpen={defaultOpen} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <DebtorTrigger debtor={debtor} masked={masked} />
        <DebtorActions
          debtor={debtor}
          accounts={accounts}
          debtors={debtors}
          privacyMode={privacyMode}
          isRevealed={isRevealed}
          onReveal={onReveal}
          onShowPayments={onShowPayments}
        />
      </div>
      <CollapsibleContent>
        {loans.length > 0 ? (
          <LoanList loans={loans} accounts={accounts} debtors={debtors} masked={masked} />
        ) : (
          <p className="border-t border-border/60 px-4 py-3 text-sm text-muted-foreground">All loans settled.</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
