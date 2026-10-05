"use client";

import { useMemo, useState } from "react";
import { ColorDot } from "@/components/ds";
import { cn } from "@/lib/utils";
import type { AccountWithBalance, DebtorWithLoans } from "@/lib/queries/loans";

const CHIP = "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors";
const chipState = (active: boolean) =>
  active ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground";

/** Narrows debtors (and their totals) to loans made from one account. */
export function filterDebtorsByAccount(debtors: DebtorWithLoans[], accountId: string | null): DebtorWithLoans[] {
  if (!accountId) return debtors;
  return debtors
    .map((d) => {
      const loans = d.loans.filter((l) => l.accountId === accountId);
      return {
        ...d,
        loans,
        totalOwed: loans.reduce((s, l) => s + l.remaining, 0),
        activeLoansCount: loans.filter((l) => l.isActive).length,
      };
    })
    .filter((d) => d.loans.length > 0);
}

export function DebtorAccountFilter({
  debtors,
  accounts,
  children,
}: {
  debtors: DebtorWithLoans[];
  accounts: AccountWithBalance[];
  children: (filtered: DebtorWithLoans[]) => React.ReactNode;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = useMemo(() => filterDebtorsByAccount(debtors, selected), [debtors, selected]);
  // Only accounts that ever lent money are worth filtering by.
  const lending = accounts.filter((a) => debtors.some((d) => d.loans.some((l) => l.accountId === a.id)));

  return (
    <>
      {lending.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSelected(null)} className={cn(CHIP, chipState(selected === null))}>
            All
          </button>
          {lending.map((a) => (
            <button
              type="button"
              key={a.id}
              onClick={() => setSelected(a.id === selected ? null : a.id)}
              className={cn(CHIP, chipState(selected === a.id))}
            >
              <ColorDot color={a.color} />
              {a.name}
            </button>
          ))}
        </div>
      )}
      {children(filtered)}
    </>
  );
}
