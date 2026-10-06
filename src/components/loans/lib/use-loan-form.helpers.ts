import { createLoan, updateLoan } from "@/lib/actions/loans";
import { localISODate, parseISODate } from "@/lib/form-format";
import type { LoanWithRemaining } from "@/lib/queries/loans";

export interface LoanFormFields {
  debtorId: string;
  accountId: string;
  amount: string; // digits
  date: string; // YYYY-MM-DD
  expectedBy: string; // YYYY-MM-DD or ""
  notes: string;
}

/**
 * Stored date → "YYYY-MM-DD". UTC read on purpose: loans are saved at local
 * noon (same day in UTC), and older rows at UTC midnight (see dateInputValue).
 */
export function toDateInput(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → local noon (never `new Date("YYYY-MM-DD")`, which is UTC midnight). */
export function toDateObj(dateStr: string): Date {
  return parseISODate(dateStr) ?? new Date(NaN);
}

export function fieldsFromEditing(
  editing: LoanWithRemaining | null | undefined,
  defaultDebtorId: string | undefined,
  firstAccountId: string,
): LoanFormFields {
  return {
    debtorId: editing?.debtorId ?? defaultDebtorId ?? "",
    accountId: editing?.accountId ?? firstAccountId,
    amount: editing ? String(Math.round(editing.amount)) : "",
    // Local "today": the UTC date is already tomorrow after 7pm in Bogotá.
    date: editing ? toDateInput(editing.date) : localISODate(new Date()),
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
  const parsedExpectedBy = expectedBy ? toDateObj(expectedBy) : null;
  const trimmedNotes = notes.trim() || null;

  if (editing) {
    // null, not undefined: clearing the repayment date or the notes must
    // actually clear them (undefined leaves the stored value untouched).
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
      expectedBy: parsedExpectedBy ?? undefined,
      notes: trimmedNotes ?? undefined,
    });
  }
}
