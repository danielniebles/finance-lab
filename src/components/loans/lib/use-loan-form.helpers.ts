import { createLoan, updateLoan } from "@/lib/actions/loans";
import type { LoanWithRemaining } from "@/lib/queries/loans";

export interface LoanFormFields {
  debtorId: string;
  accountId: string;
  amount: string;
  date: string;
  expectedBy: string;
  notes: string;
}

export function toDateInput(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

export function toDateObj(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00");
}

function todayInput(): string {
  return toDateInput(new Date());
}

export function fieldsFromEditing(
  editing: LoanWithRemaining | null | undefined,
  defaultDebtorId: string | undefined,
  firstAccountId: string,
): LoanFormFields {
  return {
    debtorId: editing?.debtorId ?? defaultDebtorId ?? "",
    accountId: editing?.accountId ?? firstAccountId,
    amount: editing ? String(editing.amount) : "",
    date: editing ? toDateInput(editing.date) : todayInput(),
    expectedBy: editing?.expectedBy ? toDateInput(editing.expectedBy) : "",
    notes: editing?.notes ?? "",
  };
}

export async function submitLoan(
  editing: LoanWithRemaining | null | undefined,
  fields: LoanFormFields,
): Promise<void> {
  const { accountId, amount, date, expectedBy, notes } = fields;
  const parsedAmount = parseFloat(amount);
  const parsedDate = toDateObj(date);
  const parsedExpectedBy = expectedBy ? toDateObj(expectedBy) : undefined;
  const trimmedNotes = notes.trim() || undefined;

  if (editing) {
    await updateLoan(editing.id, {
      accountId,
      amount: parsedAmount,
      date: parsedDate,
      expectedBy: parsedExpectedBy,
      notes: trimmedNotes,
    });
  } else {
    await createLoan({
      debtorId: fields.debtorId,
      accountId,
      amount: parsedAmount,
      date: parsedDate,
      expectedBy: parsedExpectedBy,
      notes: trimmedNotes,
    });
  }
}
