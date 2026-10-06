"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField, Field, FormDialog, FormFooter, Money, MoneyInput, OptionSelect } from "@/components/ds";
import { deleteLoan } from "@/lib/actions/loans";
import { loanAmountError, loanMissingHint } from "@/lib/loan-forms";
import { TONE_CLASSES } from "@/lib/status";
import type { AccountWithBalance, DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";
import { useLoanForm } from "./hooks/use-loan-form";
import { accountOptions } from "./lib/account-options";

type LoanFormState = ReturnType<typeof useLoanForm>;

function LoanFields({
  form,
  editing,
  accounts,
  debtors,
}: {
  form: LoanFormState;
  editing?: LoanWithRemaining | null;
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
}) {
  const amountError = loanAmountError(parseFloat(form.amount), editing);
  const disabled = form.pending;
  return (
    <>
      <Field label="Lent to" hint={editing ? "A loan stays with the person it was lent to." : undefined}>
        <OptionSelect
          ariaLabel="Lent to"
          value={form.debtorId || null}
          onChange={(v) => form.setDebtorId(v ?? "")}
          placeholder="Pick a person…"
          options={debtors.map((d) => ({ value: d.id, label: d.name }))}
          disabled={disabled || !!editing}
        />
      </Field>
      <Field label="From account">
        <OptionSelect
          ariaLabel="From account"
          value={form.accountId || null}
          onChange={(v) => form.setAccountId(v ?? "")}
          placeholder="Pick an account…"
          options={accountOptions(accounts, { withBalance: true })}
          disabled={disabled}
        />
      </Field>
      <Field
        label="Amount"
        htmlFor="loan-amount"
        error={amountError}
        hint={
          editing && editing.paid > 0 ? (
            <>
              Repaid so far: <Money value={editing.paid} className="text-foreground" />
            </>
          ) : undefined
        }
      >
        <MoneyInput id="loan-amount" size="lg" value={form.amount} onValueChange={form.setAmount} invalid={!!amountError} required disabled={disabled} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="loan-date">
          <DateField id="loan-date" value={form.date} onChange={form.setDate} required disabled={disabled} />
        </Field>
        <Field label="Pay back by" htmlFor="loan-expected" optional>
          <DateField id="loan-expected" value={form.expectedBy} onChange={form.setExpectedBy} min={form.date} clearable disabled={disabled} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="loan-notes" optional>
        <Input id="loan-notes" value={form.notes} onChange={(e) => form.setNotes(e.target.value)} placeholder="What it was for" disabled={disabled} />
      </Field>
    </>
  );
}

function footerHint(error: string | null, pending: boolean, missing: string): React.ReactNode {
  if (error) return <span className={TONE_CLASSES.danger.text}>{error}</span>;
  return pending ? "" : missing;
}

function DeleteLoanStep({
  open,
  onClose,
  loan,
  debtorName,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  loan: LoanWithRemaining;
  debtorName?: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const n = loan.payments.length;
  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Delete loan?"
      footer={
        <FormFooter>
          <Button type="button" variant="outline" onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            Delete loan
          </Button>
        </FormFooter>
      }
    >
      <p className="text-sm text-muted-foreground">
        <Money value={loan.amount} className="text-foreground" /> to {debtorName ?? "this person"}.{" "}
        {n > 0 ? `Its ${n} ${n === 1 ? "payment is" : "payments are"} deleted too.` : "It has no payments."}
      </p>
    </FormDialog>
  );
}

export function LoanForm({
  open,
  onClose,
  accounts,
  debtors,
  defaultDebtorId,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  defaultDebtorId?: string;
  editing?: LoanWithRemaining | null;
}) {
  const form = useLoanForm({ accounts, debtors, defaultDebtorId, editing, onClose, open });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePending, startDelete] = useTransition();

  // Reset the delete-confirm step whenever the dialog (re)opens.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setConfirmingDelete(false);
  }

  function handleDelete() {
    if (!editing) return;
    startDelete(async () => {
      await deleteLoan(editing.id);
      onClose();
    });
  }

  if (confirmingDelete && editing) {
    return (
      <DeleteLoanStep
        open={open}
        onClose={onClose}
        loan={editing}
        debtorName={form.selectedDebtor?.name}
        pending={deletePending}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
      />
    );
  }

  const missing = loanMissingHint(form.fields);
  const blocked = !!missing || !!loanAmountError(parseFloat(form.amount), editing);

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Edit loan" : "New loan"}
      onSubmit={form.handleSubmit}
      footer={
        <FormFooter hint={footerHint(form.error, form.pending, missing)}>
          {editing && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
              onClick={() => setConfirmingDelete(true)}
              disabled={form.pending}
            >
              Delete
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={form.pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.pending || blocked}>
            {form.pending ? "Saving…" : editing ? "Save changes" : "Record loan"}
          </Button>
        </FormFooter>
      }
    >
      <LoanFields form={form} editing={editing} accounts={accounts} debtors={debtors} />
    </FormDialog>
  );
}
