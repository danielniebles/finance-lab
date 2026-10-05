"use client";

import { useState } from "react";
import { sortLoans } from "@/lib/loan-display";
import { cn } from "@/lib/utils";
import type { AccountWithBalance, DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";
import { LOAN_GRID, LoanRow } from "./loan-row";

/** Long loan histories collapse after this many rows. */
export const LOANS_VISIBLE = 5;

export function LoanList({
  loans,
  accounts,
  debtors,
  masked,
}: {
  loans: LoanWithRemaining[];
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  masked: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const sorted = sortLoans(loans);
  const shown = expanded ? sorted : sorted.slice(0, LOANS_VISIBLE);
  const hidden = sorted.length - shown.length;

  return (
    <div className="border-t border-border/60">
      <div className={cn("hidden px-4 py-2 text-xs text-muted-foreground", LOAN_GRID)}>
        <span>Date</span>
        <span>Note</span>
        <span className="text-right">Original</span>
        <span className="text-right">Remaining</span>
        <span className="text-right">Age</span>
        <span className="text-right">Status</span>
      </div>
      <ul className="sm:border-t sm:border-border/40">
        {shown.map((loan) => (
          <LoanRow key={loan.id} loan={loan} accounts={accounts} debtors={debtors} masked={masked} />
        ))}
      </ul>
      {(hidden > 0 || expanded) && sorted.length > LOANS_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full border-t border-border/40 px-4 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? "Show fewer" : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}
