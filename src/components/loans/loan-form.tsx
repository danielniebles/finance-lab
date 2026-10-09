"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckField, DateField, Field, FormDialog, FormFooter, Money, MoneyInput, OptionSelect } from "@/components/ds";
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

type DeleteLoanOptions = { keepTransaction: boolean; deleteRepayments: boolean };

/** "It was a mistake" undoes the loan: its transaction goes and the installments it paid go back to unpaid. */
function MistakeField({
  loan,
  checked,
  onChange,
  disabled,
}: {
  loan: LoanWithRemaining;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  const linked = loan.linkedTransaction;
  const slots = loan.installmentSlots;
  if (!linked && slots === 0) return null;
  const undoes = [
    linked ? <>deletes its transaction (<Money value={linked.amount} /> from {linked.wallet})</> : null,
    slots > 0 ? `marks its ${slots} ${slots === 1 ? "installment" : "installments"} unpaid` : null,
  ].filter(Boolean);
  return (
    <CheckField
      id="delete-loan-mistake"
      label="It was a mistake — undo it"
      hint={
        <>
          {undoes.map((part, i) => (
            <span key={i}>
              {i === 0 ? "Also " : " and "}
              {part}
            </span>
          ))}
          . Uncheck it if the money really left and they just don&apos;t owe it anymore.
        </>
      }
      checked={checked}
      onChange={onChange}
      disabled={disabled}
    />
  );
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
  onConfirm: (opts: DeleteLoanOptions) => void;
}) {
  const n = loan.payments.length;
  const [mistake, setMistake] = useState(true);
  const [deleteRepayments, setDeleteRepayments] = useState(false);
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
          <Button type="button" variant="destructive" disabled={pending} onClick={() => onConfirm({ keepTransaction: !mistake, deleteRepayments })}>
            Delete loan
          </Button>
        </FormFooter>
      }
    >
      <p className="text-sm text-muted-foreground">
        <Money value={loan.amount} className="text-foreground" /> to {debtorName ?? "this person"}.
      </p>
      <MistakeField loan={loan} checked={mistake} onChange={setMistake} disabled={pending} />
      {n > 0 && (
        <CheckField
          id="delete-loan-repayments"
          label={`Also delete its ${n} ${n === 1 ? "repayment" : "repayments"}`}
          hint={
            <>
              <Money value={loan.paid} /> received. Delete them only if that money never came in — otherwise it stays in
              your balance.
            </>
          }
          checked={deleteRepayments}
          onChange={setDeleteRepayments}
          disabled={pending}
        />
      )}
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

  function handleDelete(opts: DeleteLoanOptions) {
    if (!editing) return;
    startDelete(async () => {
      await deleteLoan(editing.id, opts);
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
