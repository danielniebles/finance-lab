"use client";

import { useState, useTransition } from "react";
import type { AccountWithBalance, DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";
import { fieldsFromEditing, submitLoan, type LoanFormFields } from "../lib/use-loan-form.helpers";

interface UseLoanFormProps {
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  defaultDebtorId?: string;
  editing?: LoanWithRemaining | null;
  onClose: () => void;
  /** When given, the form resets each time the dialog opens (it stays mounted between opens). */
  open?: boolean;
}

export function useLoanForm({ accounts, debtors, defaultDebtorId, editing, onClose, open }: UseLoanFormProps) {
  const firstAccountId = accounts[0]?.id ?? "";

  const [fields, setFields] = useState<LoanFormFields>(() =>
    fieldsFromEditing(editing, defaultDebtorId, firstAccountId)
  );
  const [last, setLast] = useState(editing);
  const [lastOpen, setLastOpen] = useState(open);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (editing !== last) {
    setLast(editing);
    setFields(fieldsFromEditing(editing, defaultDebtorId, firstAccountId));
  }
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setFields(fieldsFromEditing(editing, defaultDebtorId, firstAccountId));
      setError(null);
    }
  }

  const set = <K extends keyof LoanFormFields>(k: K) => (v: LoanFormFields[K]) => setFields((s) => ({ ...s, [k]: v }));
  const setDebtorId = set("debtorId");
  const setAccountId = set("accountId");
  const setAmount = set("amount");
  const setDate = set("date");
  const setExpectedBy = set("expectedBy");
  const setNotes = set("notes");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await submitLoan(editing, fields);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const selectedDebtor = debtors.find((d) => d.id === fields.debtorId);
  const selectedAccount = accounts.find((a) => a.id === fields.accountId);

  return {
    fields,
    debtorId: fields.debtorId, setDebtorId,
    accountId: fields.accountId, setAccountId,
    amount: fields.amount, setAmount,
    date: fields.date, setDate,
    expectedBy: fields.expectedBy, setExpectedBy,
    notes: fields.notes, setNotes,
    pending,
    error,
    handleSubmit,
    selectedDebtor,
    selectedAccount,
  };
}
