"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Money } from "@/components/ds";
import { readSavedNote, ShareStatementDialog } from "@/components/shared/share-statement-dialog";
import { debtorStatement } from "@/lib/share-statement";
import { TONE_CLASSES } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";
import { loanDate } from "./loan-row";

const LABEL = "font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground";

/** Loans left out of a debtor's statement last time, so the next share starts from that pick. */
const excludedKey = (debtorId: string) => `share-loans-excluded-${debtorId}`;

function readExcluded(debtorId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(excludedKey(debtorId)) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveExcluded(debtorId: string, ids: string[]) {
  try {
    localStorage.setItem(excludedKey(debtorId), JSON.stringify(ids));
  } catch {
    // Private mode or blocked storage: every loan is ticked next time.
  }
}

/** Active loans, oldest first: the statement's order. */
function activeLoans(debtor: DebtorWithLoans): LoanWithRemaining[] {
  return debtor.loans.filter((l) => l.isActive).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function LoanOption({ loan, checked, onChange }: { loan: LoanWithRemaining; checked: boolean; onChange: (on: boolean) => void }) {
  const id = `share-loan-${loan.id}`;
  const [title, ...rest] = (loan.notes ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const meta = [loanDate(loan.date), rest[0]].filter(Boolean).join(" · ");
  return (
    <li>
      <label
        htmlFor={id}
        className="grid min-h-13 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-border/40 px-3 py-1.5 transition-colors hover:bg-muted/40"
      >
        <span className="flex">
          <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
        </span>
        <span className={cn("flex min-w-0 flex-col gap-0.5", !checked && "text-muted-foreground")}>
          <span className="truncate text-sm font-medium">{title || "Loan"}</span>
          <span className="truncate text-xs text-muted-foreground">{meta}</span>
        </span>
        <Money value={loan.remaining} className={cn("text-sm", !checked && "text-muted-foreground")} />
      </label>
    </li>
  );
}

/** Which active loans go in the statement; the header ticks or unticks them all, like Pay bills. */
function LoanPicker({ loans, selected, onChange }: { loans: LoanWithRemaining[]; selected: ReadonlySet<string>; onChange: (next: Set<string>) => void }) {
  const all = selected.size === loans.length;
  function toggle(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onChange(next);
  }
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="sr-only">Loans to include</legend>
      <div className="flex flex-col rounded-xl border border-border/60 bg-muted/20">
        <div className="flex items-center gap-3 px-3">
          <label htmlFor="share-loans-all" className="flex min-h-11 cursor-pointer items-center gap-3">
            <span className="flex">
              <Checkbox
                id="share-loans-all"
                checked={all}
                indeterminate={selected.size > 0 && !all}
                onCheckedChange={(v) => onChange(v === true ? new Set(loans.map((l) => l.id)) : new Set())}
              />
            </span>
            <span className={LABEL}>Loans to include</span>
          </label>
          <span className="ml-auto text-xs text-muted-foreground">
            {selected.size} of {loans.length}
          </span>
        </div>
        <ul className="flex flex-col">
          {loans.map((l) => (
            <LoanOption key={l.id} loan={l} checked={selected.has(l.id)} onChange={(on) => toggle(l.id, on)} />
          ))}
        </ul>
      </div>
      <span className="text-xs text-muted-foreground">Oldest first, as in the statement. Your pick is remembered for next time.</span>
    </fieldset>
  );
}

function PickSummary({ count, of, total }: { count: number; of: number; total: number }) {
  if (count === 0) return <span className={TONE_CLASSES.caution.text}>Pick at least one loan to share.</span>;
  return (
    <span className="flex items-baseline gap-2">
      {count} of {of} · total <Money value={total} className="text-base font-semibold text-foreground" />
    </span>
  );
}

/** Sends a debtor their current statement (all or some loans), as an image or text. */
export function ShareDebtorButton({ debtor }: { debtor: DebtorWithLoans }) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState(debtor.name);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const loans = activeLoans(debtor);

  function openDialog() {
    const excluded = readExcluded(debtor.id);
    setRecipient(debtor.name);
    setNote(readSavedNote());
    setSelected(new Set(loans.filter((l) => !excluded.has(l.id)).map((l) => l.id)));
    setOpen(true);
  }

  function pick(next: Set<string>) {
    setSelected(next);
    saveExcluded(debtor.id, loans.filter((l) => !next.has(l.id)).map((l) => l.id));
  }

  const statement = debtorStatement(debtor, { recipient, note, loanIds: selected });
  const picking = loans.length > 1;

  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={openDialog}>
        <Share2 className="size-3.5" />
        Share
      </Button>
      <ShareStatementDialog
        open={open}
        onOpenChange={setOpen}
        title={`Share ${debtor.name}'s statement`}
        recipient={recipient}
        onRecipientChange={setRecipient}
        note={note}
        onNoteChange={setNote}
        statement={statement}
        summary={picking ? <PickSummary count={statement.lines.length} of={loans.length} total={statement.total} /> : undefined}
        canShare={!picking || statement.lines.length > 0}
      >
        {picking ? <LoanPicker loans={loans} selected={selected} onChange={pick} /> : undefined}
      </ShareStatementDialog>
    </>
  );
}
