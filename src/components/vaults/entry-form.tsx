"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ColorDot,
  DateField,
  Field,
  FormDialog,
  FormFooter,
  Money,
  MoneyInput,
  OptionSelect,
  SegmentedControl,
} from "@/components/ds";
import { categorySelectOptions } from "@/components/shared/category-option";
import { addVaultEntry } from "@/lib/actions/vaults";
import { formatCOP } from "@/lib/format";
import { localISODate, parseISODate } from "@/lib/form-format";
import { TONE_CLASSES } from "@/lib/status";
import type { AccountWithWallets } from "@/lib/queries/wallets";
import type { CategoryOption } from "@/lib/queries/expenses";

type Direction = "contribute" | "withdraw";

type Props = {
  open: boolean;
  direction: Direction;
  vaultId: string;
  vaultName: string;
  currentBalance: number;
  onClose: () => void;
  walletAccounts: AccountWithWallets[];
  categories: CategoryOption[];
};

type FormState = {
  amount: string; // digits
  date: string; // YYYY-MM-DD
  notes: string;
  walletId: string | null;
  appCategoryId: string | null;
};

const emptyForm = (): FormState => ({
  amount: "",
  date: localISODate(new Date()),
  notes: "",
  walletId: null,
  appCategoryId: null,
});

const DIRECTION_OPTIONS = [
  { value: "contribute" as const, label: "Contribute" },
  { value: "withdraw" as const, label: "Withdraw" },
];

function walletOptions(accounts: AccountWithWallets[]) {
  return accounts.flatMap((a) =>
    a.wallets.map((w) => ({
      value: w.id,
      label: `${a.wallets.length > 1 ? `${a.name} · ${w.name}` : a.name} — ${formatCOP(w.balance)}`,
      leading: <ColorDot color={w.color ?? a.color} />,
    })),
  );
}

/** What's still missing before the entry can be saved ("" when ready). */
export function entryMissingHint(form: FormState, direction: Direction): string {
  const amount = parseFloat(form.amount);
  if (Number.isNaN(amount) || amount <= 0) return "Add an amount to save.";
  if (direction === "contribute" && form.walletId && !form.appCategoryId) return "Pick a category for the wallet expense.";
  return "";
}

export function EntryForm({
  open,
  direction: initialDirection,
  vaultId,
  vaultName,
  currentBalance,
  onClose,
  walletAccounts,
  categories,
}: Props) {
  const [direction, setDirection] = useState<Direction>(initialDirection);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // The dialog stays mounted between opens: reset when it opens, so a
  // "Withdraw" click doesn't reopen on the last direction or amount.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setDirection(initialDirection);
      setForm(emptyForm());
      setError(null);
    }
  }

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((prev) => ({ ...prev, [k]: v }));

  const amount = parseFloat(form.amount);
  const wouldOverdraw = direction === "withdraw" && amount > currentBalance;
  const missing = entryMissingHint(form, direction);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (missing) return;
    setError(null);
    const walletId = direction === "contribute" && form.walletId ? form.walletId : undefined;
    startTransition(async () => {
      try {
        await addVaultEntry(vaultId, direction === "contribute" ? amount : -amount, {
          date: parseISODate(form.date) ?? undefined,
          notes: form.notes.trim() || undefined,
          walletId,
          appCategoryId: walletId ? (form.appCategoryId ?? undefined) : undefined,
        });
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
      title={`${direction === "contribute" ? "Contribute to" : "Withdraw from"} ${vaultName}`}
      onSubmit={handleSubmit}
      footer={
        <FormFooter hint={error ? <span className={TONE_CLASSES.danger.text}>{error}</span> : pending ? "" : missing}>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !!missing}>
            {pending ? "Saving…" : direction === "contribute" ? "Record contribution" : "Record withdrawal"}
          </Button>
        </FormFooter>
      }
    >
      <SegmentedControl ariaLabel="Entry type" value={direction} onChange={setDirection} options={DIRECTION_OPTIONS} />
      <Field
        label="Amount"
        htmlFor="entry-amount"
        error={wouldOverdraw ? "More than the vault holds." : undefined}
        hint={
          direction === "withdraw" ? (
            <>
              In the vault: <Money value={currentBalance} className="text-foreground" />
            </>
          ) : undefined
        }
      >
        <MoneyInput id="entry-amount" size="lg" value={form.amount} onValueChange={(v) => setField("amount", v)} invalid={wouldOverdraw} autoFocus required disabled={pending} />
      </Field>
      <Field label="Date" htmlFor="entry-date">
        <DateField id="entry-date" value={form.date} onChange={(v) => setField("date", v)} quickPicks={["today", "yesterday"]} disabled={pending} />
      </Field>
      {direction === "contribute" && walletAccounts.length > 0 && (
        <ContributionSource form={form} setField={setField} walletAccounts={walletAccounts} categories={categories} disabled={pending} />
      )}
      <Field label="Notes" htmlFor="entry-notes" optional>
        <Input id="entry-notes" value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="e.g. Salary transfer" disabled={pending} />
      </Field>
    </FormDialog>
  );
}

/** Contribution from a real wallet: records a matching expense, so it needs a category. */
function ContributionSource({
  form,
  setField,
  walletAccounts,
  categories,
  disabled,
}: {
  form: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  walletAccounts: AccountWithWallets[];
  categories: CategoryOption[];
  disabled: boolean;
}) {
  return (
    <>
      <Field
        label="From wallet"
        optional
        hint={
          form.walletId
            ? "Also records an expense from this wallet, so its balance goes down like any other spend."
            : "None keeps it notional: the vault grows, no wallet changes."
        }
      >
        <OptionSelect
          ariaLabel="From wallet"
          value={form.walletId}
          onChange={(v) => setField("walletId", v)}
          noneLabel="None (notional)"
          options={walletOptions(walletAccounts)}
          disabled={disabled}
        />
      </Field>
      {form.walletId && (
        <Field label="Category">
          <OptionSelect
            ariaLabel="Category"
            value={form.appCategoryId}
            onChange={(v) => setField("appCategoryId", v)}
            options={categorySelectOptions(categories.filter((c) => !c.isTransfer))}
            disabled={disabled}
          />
        </Field>
      )}
    </>
  );
}
