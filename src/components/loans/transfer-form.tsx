"use client";

import { useState, useTransition } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField, Field, FormDialog, FormFooter, Money, MoneyInput, OptionSelect } from "@/components/ds";
import { createTransfer } from "@/lib/actions/loans";
import { localISODate, parseISODate } from "@/lib/form-format";
import { nextTransferTarget, transferMissingHint } from "@/lib/loan-forms";
import { TONE_CLASSES } from "@/lib/status";
import type { AccountWithBalance } from "@/lib/queries/loans";
import { accountOptions } from "./lib/account-options";

type FormState = {
  fromId: string;
  toId: string;
  amount: string; // digits
  date: string; // YYYY-MM-DD
  notes: string;
};

function emptyForm(accounts: AccountWithBalance[]): FormState {
  const fromId = accounts[0]?.id ?? "";
  return { fromId, toId: nextTransferTarget(fromId, "", accounts), amount: "", date: localISODate(new Date()), notes: "" };
}

export function TransferForm({
  open,
  onClose,
  accounts,
}: {
  open: boolean;
  onClose: () => void;
  accounts: AccountWithBalance[];
}) {
  const [form, setForm] = useState<FormState>(() => emptyForm(accounts));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setForm(emptyForm(accounts));
      setError(null);
    }
  }

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));
  // Picking the current destination as the source moves the destination
  // elsewhere, instead of leaving an impossible "A → A" transfer.
  const setFrom = (id: string) => setForm((p) => ({ ...p, fromId: id, toId: nextTransferTarget(id, p.toId, accounts) }));

  const from = accounts.find((a) => a.id === form.fromId);
  const amount = parseFloat(form.amount);
  const missing = transferMissingHint(form.fromId, form.toId, amount);
  const overdraws = !!from && amount > from.balance;
  const options = accountOptions(accounts, { withBalance: true });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const date = parseISODate(form.date);
    if (missing || !date) return;
    setError(null);
    startTransition(async () => {
      try {
        await createTransfer({ fromAccountId: form.fromId, toAccountId: form.toId, amount, date, notes: form.notes.trim() || undefined });
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
      title="Transfer between accounts"
      onSubmit={handleSubmit}
      footer={
        <FormFooter hint={error ? <span className={TONE_CLASSES.danger.text}>{error}</span> : pending ? "" : missing}>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !!missing}>
            {pending ? "Saving…" : "Transfer"}
          </Button>
        </FormFooter>
      }
    >
      <div className="flex flex-col gap-1">
        <Field label="From">
          <OptionSelect ariaLabel="From account" value={form.fromId || null} onChange={(v) => setFrom(v ?? "")} options={options} placeholder="Pick an account…" disabled={pending} />
        </Field>
        <ArrowDown className="mx-auto mt-2 size-4 text-muted-foreground" aria-hidden />
        <Field label="To">
          <OptionSelect
            ariaLabel="To account"
            value={form.toId || null}
            onChange={(v) => setField("toId", v ?? "")}
            options={options.filter((o) => o.value !== form.fromId)}
            placeholder="Pick an account…"
            disabled={pending}
          />
        </Field>
      </div>
      <Field
        label="Amount"
        htmlFor="transfer-amount"
        hint={
          overdraws && from ? (
            <span className={TONE_CLASSES.caution.text}>
              More than {from.name} holds (<Money value={from.balance} />). It will go negative.
            </span>
          ) : undefined
        }
      >
        <MoneyInput id="transfer-amount" size="lg" value={form.amount} onValueChange={(v) => setField("amount", v)} required disabled={pending} />
      </Field>
      <Field label="Date" htmlFor="transfer-date">
        <DateField id="transfer-date" value={form.date} onChange={(v) => setField("date", v)} quickPicks={["today", "yesterday"]} required disabled={pending} />
      </Field>
      <Field label="Notes" htmlFor="transfer-notes" optional>
        <Input id="transfer-notes" value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="e.g. Move to CDT" disabled={pending} />
      </Field>
    </FormDialog>
  );
}
