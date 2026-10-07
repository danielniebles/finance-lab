"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorDot, DateField, Field, FormDialog, FormFooter, Money, MoneyInput, OptionSelect } from "@/components/ds";
import { recordPayment } from "@/lib/actions/loans";
import { formatCOP, formatStoredDate } from "@/lib/format";
import { localISODate, parseISODate } from "@/lib/form-format";
import { accountsWithOpenLoans, allocatePayment, paymentMissingHint, type PaymentSplit } from "@/lib/loan-forms";
import { TONE_CLASSES } from "@/lib/status";
import type { AccountWithBalance, DebtorWithLoans } from "@/lib/queries/loans";
import { accountOptions } from "./lib/account-options";

type FormState = {
  debtorId: string;
  accountId: string; // "" = all accounts
  amount: string; // digits
  date: string; // YYYY-MM-DD
  notes: string;
};

const emptyForm = (debtorId?: string): FormState => ({
  debtorId: debtorId ?? "",
  accountId: "",
  amount: "",
  date: localISODate(new Date()),
  notes: "",
});

/** Which loans the payment goes to, newest first — the same split recordPayment makes. */
function AllocationPreview({ splits }: { splits: PaymentSplit[] }) {
  if (splits.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted px-3 py-2.5">
      <span className="text-xs text-muted-foreground">Goes to · newest loan first</span>
      <ul className="flex flex-col gap-1">
        {splits.map(({ loan, apply }) => (
          <li key={loan.id} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <ColorDot color={loan.accountColor} />
              <span className="truncate">
                {formatStoredDate(loan.date, { month: "short", day: "numeric", year: "2-digit" })} ·{" "}
                {loan.notes ?? loan.accountName}
              </span>
            </span>
            <span className="flex shrink-0 items-baseline gap-1.5">
              <Money value={apply} signed tone="positive" className="font-medium" />
              {apply >= loan.remaining && <span className="text-muted-foreground">settles it</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type PaymentFormArgs = {
  open: boolean;
  onClose: () => void;
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  defaultDebtorId?: string;
};

function usePaymentForm({ open, onClose, accounts, debtors, defaultDebtorId }: PaymentFormArgs) {
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultDebtorId));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Stays mounted between opens: start clean each time (the old form kept
  // the last amount after recording a payment).
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setForm(emptyForm(defaultDebtorId));
      setError(null);
    }
  }

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));
  // A new debtor has different loans: the account filter starts over.
  const setDebtor = (id: string) => setForm((p) => ({ ...p, debtorId: id, accountId: "" }));

  const debtor = debtors.find((d) => d.id === form.debtorId);
  const amount = parseFloat(form.amount);
  const allocation = allocatePayment(debtor, form.accountId, amount);
  const missing = paymentMissingHint(form.debtorId, amount, allocation);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const date = parseISODate(form.date);
    if (missing || !date) return;
    setError(null);
    startTransition(async () => {
      try {
        await recordPayment({
          debtorId: form.debtorId,
          accountId: form.accountId || undefined,
          totalAmount: amount,
          date,
          notes: form.notes.trim() || undefined,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return {
    form, setField, setDebtor, debtor, allocation, missing, pending, error, handleSubmit,
    debtorAccounts: accountsWithOpenLoans(debtor, accounts),
  };
}

type PaymentFormModel = ReturnType<typeof usePaymentForm>;

function AmountField({ m, autoFocus }: { m: PaymentFormModel; autoFocus: boolean }) {
  const { allocation, form, setField, pending } = m;
  const over = allocation.unallocated > 0;
  return (
    <Field
      label="Amount received"
      htmlFor="pay-amount"
      error={over ? "More than they owe." : undefined}
      aside={
        allocation.owed > 0 ? (
          <button
            type="button"
            onClick={() => setField("amount", String(Math.floor(allocation.owed)))}
            disabled={pending}
            className="text-xs font-medium text-primary hover:underline"
          >
            All of it
          </button>
        ) : undefined
      }
      hint={
        m.debtor ? (
          <>
            Owes <Money value={allocation.owed} className="text-foreground" />
            {form.accountId ? " on this account" : ""}
          </>
        ) : undefined
      }
    >
      <MoneyInput id="pay-amount" size="lg" value={form.amount} onValueChange={(v) => setField("amount", v)} invalid={over} autoFocus={autoFocus} required disabled={pending} />
    </Field>
  );
}

function WhoFields({ m, debtors, askDebtor }: { m: PaymentFormModel; debtors: DebtorWithLoans[]; askDebtor: boolean }) {
  return (
    <>
      {askDebtor && (
        <Field label="From">
          <OptionSelect
            ariaLabel="Who paid"
            value={m.form.debtorId || null}
            onChange={(v) => m.setDebtor(v ?? "")}
            placeholder="Pick a person…"
            options={debtors.filter((d) => d.totalOwed > 0).map((d) => ({ value: d.id, label: `${d.name} — owes ${formatCOP(d.totalOwed)}` }))}
            disabled={m.pending}
          />
        </Field>
      )}
      {m.debtorAccounts.length > 1 && (
        <Field label="Loans from" hint="Only loans from this account are paid down.">
          <OptionSelect
            ariaLabel="Loans from"
            value={m.form.accountId || null}
            onChange={(v) => m.setField("accountId", v ?? "")}
            noneLabel="All accounts"
            options={accountOptions(m.debtorAccounts)}
            disabled={m.pending}
          />
        </Field>
      )}
    </>
  );
}

function footerHint(m: PaymentFormModel): React.ReactNode {
  if (m.error) return <span className={TONE_CLASSES.danger.text}>{m.error}</span>;
  return m.pending ? "" : m.missing;
}

export function PaymentForm(props: PaymentFormArgs) {
  const { open, onClose, debtors, defaultDebtorId } = props;
  const m = usePaymentForm(props);
  const { form, setField, pending } = m;

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={m.debtor && defaultDebtorId ? `Payment from ${m.debtor.name}` : "Record payment"}
      onSubmit={m.handleSubmit}
      footer={
        <FormFooter hint={footerHint(m)}>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !!m.missing}>
            {pending ? "Saving…" : "Record payment"}
          </Button>
        </FormFooter>
      }
    >
      <WhoFields m={m} debtors={debtors} askDebtor={!defaultDebtorId} />
      <AmountField m={m} autoFocus={!!defaultDebtorId} />
      <AllocationPreview splits={m.allocation.splits} />
      <Field label="Date" htmlFor="pay-date">
        <DateField id="pay-date" value={form.date} onChange={(v) => setField("date", v)} quickPicks={["today", "yesterday"]} required disabled={pending} />
      </Field>
      <Field label="Notes" htmlFor="pay-notes" optional>
        <Input id="pay-notes" value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="e.g. Nequi transfer" disabled={pending} />
      </Field>
    </FormDialog>
  );
}
