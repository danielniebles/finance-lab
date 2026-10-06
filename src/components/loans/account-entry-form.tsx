"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField, Field, FormDialog, FormFooter, Money, MoneyInput, SegmentedControl } from "@/components/ds";
import { createEntry } from "@/lib/actions/loans";
import { EntryType } from "@/generated/prisma";
import { localISODate, parseISODate } from "@/lib/form-format";
import { signedEntryAmount, type EntryDirection } from "@/lib/loan-forms";
import { TONE_CLASSES } from "@/lib/status";
import type { AccountWithBalance } from "@/lib/queries/loans";

type FormState = {
  type: EntryType;
  direction: EntryDirection;
  amount: string; // digits
  date: string; // YYYY-MM-DD
  notes: string;
};

const emptyForm = (): FormState => ({
  type: EntryType.ADJUSTMENT,
  direction: "add",
  amount: "",
  date: localISODate(new Date()),
  notes: "",
});

const TYPE_OPTIONS = [
  { value: EntryType.ADJUSTMENT, label: "Income / adjustment" },
  { value: EntryType.INITIAL, label: "Opening balance" },
];

const DIRECTION_OPTIONS = [
  { value: "add" as const, label: "Add" },
  { value: "deduct" as const, label: "Deduct" },
];

export function EntryForm({
  open,
  onClose,
  account,
}: {
  open: boolean;
  onClose: () => void;
  account: AccountWithBalance;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // The dialog stays mounted between opens: start clean each time.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setForm(emptyForm());
      setError(null);
    }
  }

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));
  const amount = signedEntryAmount(form.amount, form.direction);
  const missing = Number.isNaN(amount) ? "Add an amount to save." : "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const date = parseISODate(form.date);
    if (missing || !date) return;
    setError(null);
    startTransition(async () => {
      try {
        await createEntry({ accountId: account.id, type: form.type, amount, date, notes: form.notes.trim() || undefined });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Add entry · ${account.name}`}
      onSubmit={handleSubmit}
      footer={
        <FormFooter hint={error ? <span className={TONE_CLASSES.danger.text}>{error}</span> : pending ? "" : missing}>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !!missing}>
            {pending ? "Saving…" : "Add entry"}
          </Button>
        </FormFooter>
      }
    >
      <SegmentedControl ariaLabel="Entry type" value={form.type} onChange={(v) => setField("type", v)} options={TYPE_OPTIONS} />
      <Field
        label="Amount"
        htmlFor="entry-amount"
        aside={<SegmentedControl ariaLabel="Add or deduct" size="sm" value={form.direction} onChange={(v) => setField("direction", v)} options={DIRECTION_OPTIONS} />}
        hint={
          <>
            Balance now: <Money value={account.balance} className="text-foreground" />
          </>
        }
      >
        <MoneyInput id="entry-amount" size="lg" value={form.amount} onValueChange={(v) => setField("amount", v)} autoFocus required disabled={pending} />
      </Field>
      <Field label="Date" htmlFor="entry-date">
        <DateField id="entry-date" value={form.date} onChange={(v) => setField("date", v)} quickPicks={["today", "yesterday"]} required disabled={pending} />
      </Field>
      <Field label="Notes" htmlFor="entry-notes" optional>
        <Input id="entry-notes" value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="e.g. Salary deposit, bonus" disabled={pending} />
      </Field>
    </FormDialog>
  );
}
