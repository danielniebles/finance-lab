"use client";

import { Fragment, useState } from "react";
import { ColorDot, Meter, Money, StatusChip } from "@/components/ds";
import { computeLoanMeta, loanChip } from "@/lib/loan-display";
import { TONE_CLASSES } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { AccountWithBalance, DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";
import { LoanForm } from "../loan-form";
import { MASK } from "../lib/constants";

export const LOAN_GRID = "sm:grid sm:grid-cols-[7rem_minmax(0,1fr)_8rem_9.5rem_3rem_5.5rem] sm:items-center sm:gap-x-4";

/** "27 feb 2026" — es-CO's own short format ("27 de feb de 26") wraps in the column. */
export function loanDate(value: Date): string {
  const d = new Date(value);
  const month = d.toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
  return `${d.getDate()} ${month} ${d.getFullYear()}`;
}

function Amount({ value, masked, className }: { value: number; masked: boolean; className?: string }) {
  return masked ? <span className={cn("font-mono", className)}>{MASK}</span> : <Money value={value} className={className} />;
}

/** Remaining amount, plus a repaid meter only once something has been repaid. */
function Remaining({ loan, pct, masked }: { loan: LoanWithRemaining; pct: number; masked: boolean }) {
  return (
    <span className="flex flex-col items-end gap-1">
      {loan.remaining > 0 ? (
        <Amount value={loan.remaining} masked={masked} className="text-sm font-semibold" />
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      )}
      {!masked && loan.isActive && loan.paid > 0 && (
        <span className="flex w-full max-w-36 items-center gap-1.5">
          <Meter value={pct} size="sm" label="Repaid" className="flex-1" />
          <span className="font-mono text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
        </span>
      )}
    </span>
  );
}

// One responsive row: on phones the note + remaining sit on top and the
// date · original · age meta under them; from sm up it's the column grid
// whose header lives in LoanList.
export function LoanRow({
  loan,
  accounts,
  debtors,
  masked,
}: {
  loan: LoanWithRemaining;
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  masked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const meta = computeLoanMeta(loan);
  const chip = loanChip(loan, meta);
  const ageClass = meta.isStale ? cn("font-medium", TONE_CLASSES.caution.text) : "text-muted-foreground";
  const account = masked ? MASK : loan.accountName;

  return (
    <Fragment>
      <li
        onClick={masked ? undefined : () => setOpen(true)}
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-border/40 px-4 py-3 first:border-t-0",
          LOAN_GRID,
          !loan.isActive && "opacity-70",
          !masked && "cursor-pointer transition-colors hover:bg-muted/30",
        )}
      >
        <span className="hidden items-center gap-2 whitespace-nowrap text-xs text-muted-foreground sm:flex">
          <ColorDot color={loan.accountColor} title={account} />
          {loanDate(loan.date)}
        </span>
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <ColorDot color={loan.accountColor} className="sm:hidden" />
          <span className={cn("truncate", !loan.notes && "text-muted-foreground")}>{masked ? account : loan.notes ?? account}</span>
        </span>
        <Amount value={loan.amount} masked={masked} className="hidden text-right text-xs text-muted-foreground sm:block" />
        <span className="row-span-2 sm:row-span-1">
          <Remaining loan={loan} pct={meta.pct} masked={masked} />
        </span>
        <span className={cn("hidden text-right text-xs sm:block", ageClass)}>{meta.ageLabel}</span>
        <span className="hidden justify-end sm:flex">{chip && <StatusChip tone={chip.tone}>{chip.label}</StatusChip>}</span>

        {/* Phone meta line */}
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground sm:hidden">
          {loanDate(loan.date)} · of <Amount value={loan.amount} masked={masked} /> ·{" "}
          <span className={ageClass}>{meta.ageLabel}</span>
          {chip && <StatusChip tone={chip.tone}>{chip.label}</StatusChip>}
        </span>
      </li>
      {/* Sibling, not child: the dialog's clicks must not bubble to the row. */}
      {!masked && (
        <LoanForm open={open} onClose={() => setOpen(false)} accounts={accounts} debtors={debtors} editing={loan} />
      )}
    </Fragment>
  );
}
