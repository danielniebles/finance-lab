"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormDialog, FormFooter, MoneyInput, SegmentedControl } from "@/components/ds";
import { createBudgetItem, deleteBudgetItem, updateBudgetItem } from "@/lib/actions/categories";
import { BudgetType } from "@/generated/prisma";
import { amountToDigits } from "@/lib/form-format";
import { budgetItemMissingHint } from "@/lib/settings-forms";
import { TONE_CLASSES } from "@/lib/status";
import type { BudgetItemData } from "./types";

const TYPE_OPTIONS = [
  { value: BudgetType.FIXED, label: "Fixed" },
  { value: BudgetType.VARIABLE, label: "Variable" },
];

const TYPE_HINT: Record<BudgetType, string> = {
  FIXED: "A bill with a known amount (rent, internet). Shows as pending until it's paid each month.",
  VARIABLE: "Spending that moves month to month (groceries, eating out).",
};

type FormState = { name: string; amount: string; budgetType: BudgetType };

function initial(item?: BudgetItemData): FormState {
  return item
    ? { name: item.name, amount: amountToDigits(item.amount), budgetType: item.budgetType }
    : { name: "", amount: "", budgetType: BudgetType.FIXED };
}

function footerHint(error: string | null, pending: boolean, missing: string): React.ReactNode {
  if (error) return <span className={TONE_CLASSES.danger.text}>{error}</span>;
  return pending ? "" : missing;
}

/** Add a budget item to a category, or edit / delete one (`item`). */
export function BudgetItemDialog({
  categoryId,
  categoryName,
  item,
  open,
  onClose,
}: {
  categoryId: string;
  categoryName: string;
  item?: BudgetItemData;
  open: boolean;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => initial(item));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setForm(initial(item));
      setError(null);
      setConfirmingDelete(false);
    }
  }

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((p) => ({ ...p, [k]: v }));
  const missing = budgetItemMissingHint(form.name, form.amount);

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        onClose();
      } catch {
        setError("Something went wrong. Try again.");
      }
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (missing) return;
    const data = { name: form.name.trim(), amount: parseFloat(form.amount), budgetType: form.budgetType };
    run(() => (item ? updateBudgetItem(item.id, data) : createBudgetItem(categoryId, data)));
  }

  if (confirmingDelete && item) {
    return (
      <FormDialog
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title={`Delete ${item.name}?`}
        footer={
          <FormFooter hint={footerHint(error, false, "")}>
            <Button type="button" variant="outline" onClick={() => setConfirmingDelete(false)} autoFocus>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={() => run(() => deleteBudgetItem(item.id))}>
              Delete item
            </Button>
          </FormFooter>
        }
      >
        <p className="text-sm text-muted-foreground">{categoryName}&apos;s monthly budget goes down by this amount, in every month.</p>
      </FormDialog>
    );
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={item ? "Edit budget item" : "New budget item"}
      description={categoryName}
      onSubmit={handleSave}
      footer={
        <FormFooter hint={footerHint(error, pending, missing)}>
          {item && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
              disabled={pending}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !!missing}>
            {pending ? "Saving…" : item ? "Save changes" : "Add item"}
          </Button>
        </FormFooter>
      }
    >
      <Field label="Name" htmlFor="bi-name">
        <Input id="bi-name" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Rent" autoFocus required disabled={pending} />
      </Field>
      <Field label="Per month" htmlFor="bi-amount">
        <MoneyInput id="bi-amount" size="lg" value={form.amount} onValueChange={(v) => setField("amount", v)} required disabled={pending} />
      </Field>
      <Field label="Type" hint={TYPE_HINT[form.budgetType]}>
        <SegmentedControl ariaLabel="Budget type" value={form.budgetType} onChange={(v) => setField("budgetType", v)} options={TYPE_OPTIONS} />
      </Field>
    </FormDialog>
  );
}
