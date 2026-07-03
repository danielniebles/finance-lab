"use client";

import { useState, useTransition } from "react";
import type { AccountWithBalance, DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";
import { fieldsFromEditing, submitLoan } from "../lib/use-loan-form.helpers";

// FormFields type — mirrors what fieldsFromEditing returns
type FormFields = {
  debtorId: string;
  accountId: string;
  amount: string;
  date: string;
  expectedBy: string;
  notes: string;
};

interface UseLoanFormProps {
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  defaultDebtorId?: string;
  editing?: LoanWithRemaining | null;
  onClose: () => void;
}

export function useLoanForm({ accounts, debtors, defaultDebtorId, editing, onClose }: UseLoanFormProps) {
  const firstAccountId = accounts[0]?.id ?? "";

  const [fields, setFields] = useState<FormFields>(() =>
    fieldsFromEditing(editing, defaultDebtorId, firstAccountId)
  );
  const [last, setLast] = useState(editing);
  const [pending, startTransition] = useTransition();

  if (editing !== last) {
    setLast(editing);
    setFields(fieldsFromEditing(editing, defaultDebtorId, firstAccountId));
  }

  const setDebtorId = (v: string) => setFields(s => ({ ...s, debtorId: v }));
  const setAccountId = (v: string) => setFields(s => ({ ...s, accountId: v }));
  const setAmount = (v: string) => setFields(s => ({ ...s, amount: v }));
  const setDate = (v: string) => setFields(s => ({ ...s, date: v }));
  const setExpectedBy = (v: string) => setFields(s => ({ ...s, expectedBy: v }));
  const setNotes = (v: string) => setFields(s => ({ ...s, notes: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await submitLoan(editing, fields);
      onClose();
    });
  }

  const selectedDebtor = debtors.find((d) => d.id === fields.debtorId);
  const selectedAccount = accounts.find((a) => a.id === fields.accountId);

  return {
    debtorId: fields.debtorId, setDebtorId,
    accountId: fields.accountId, setAccountId,
    amount: fields.amount, setAmount,
    date: fields.date, setDate,
    expectedBy: fields.expectedBy, setExpectedBy,
    notes: fields.notes, setNotes,
    pending,
    handleSubmit,
    selectedDebtor,
    selectedAccount,
  };
}
