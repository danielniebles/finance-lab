"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DateField,
  Field,
  FormDialog,
  FormFooter,
  FormReadout,
  Money,
  MoneyInput,
  OptionSelect,
} from "@/components/ds";
import { categorySelectOptions } from "@/components/shared/category-option";
import { createRecurringExpense, updateRecurringExpense } from "@/lib/actions/recurring";
import { dateInputValue } from "@/lib/format";
import { amountToDigits, localISODate, parseISODate } from "@/lib/form-format";
import { monthlySetAside } from "@/lib/recurring-utils";
import { TONE_CLASSES } from "@/lib/status";
import type { CategoryOption } from "@/lib/queries/expenses";
import type { RecurringExpenseRow } from "@/lib/queries/recurring";
import type { VaultWithMetrics } from "@/lib/queries/vaults";

/** What the form needs from the page: categories to link, and the month for the set-aside preview. */
export type RecurringFormContext = {
  categories: CategoryOption[];
  month: number;
  year: number;
  startDay: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  vault?: VaultWithMetrics;
  expense?: RecurringExpenseRow;
  recurringVaults: VaultWithMetrics[];
  context: RecurringFormContext;
};

const CADENCE_OPTIONS = [
  { label: "Monthly", value: "1" },
  { label: "Every 2 months", value: "2" },
  { label: "Quarterly", value: "3" },
  { label: "Every 6 months", value: "6" },
  { label: "Yearly", value: "12" },
  { label: "Custom…", value: "custom" },
];

function cadenceToSelectValue(months: number): string {
  return CADENCE_OPTIONS.some((o) => o.value === String(months)) ? String(months) : "custom";
}

type FormState = {
  name: string;
  estimatedAmount: string; // digits
  cadenceSelect: string;
  cadenceCustom: string;
  nextDueDate: string; // YYYY-MM-DD
  appCategoryId: string | null;
  fundingVaultId: string | null;
  notes: string;
};

function toFormState(expense: RecurringExpenseRow): FormState {
  return {
    name: expense.name,
    estimatedAmount: amountToDigits(expense.estimatedAmount),
    cadenceSelect: cadenceToSelectValue(expense.cadenceMonths),
    cadenceCustom: String(expense.cadenceMonths),
    // UTC read on purpose (see dateInputValue): older rows were saved as UTC
    // midnight; new saves are local noon, which reads back the same either way.
    nextDueDate: dateInputValue(new Date(expense.nextDueDate)),
    appCategoryId: expense.appCategoryId,
    fundingVaultId: expense.fundingVaultId,
    // Was always "" before, so every edit wiped the saved notes.
    notes: expense.notes ?? "",
  };
}

function emptyForm(vaultId?: string): FormState {
  return {
    name: "",
    estimatedAmount: "",
    cadenceSelect: "1",
    cadenceCustom: "",
    nextDueDate: localISODate(new Date()),
    appCategoryId: null,
    fundingVaultId: vaultId ?? null,
    notes: "",
  };
}

function resolvedCadence(form: FormState): number {
  if (form.cadenceSelect === "custom") return Math.max(1, parseInt(form.cadenceCustom, 10) || 1);
  return parseInt(form.cadenceSelect, 10);
}

export function RecurringExpenseForm({ open, onClose, vault, expense, recurringVaults, context }: Props) {
  const isEdit = !!expense;
  const [form, setForm] = useState<FormState>(() => (expense ? toFormState(expense) : emptyForm(vault?.id)));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setError(null);
    onClose();
  }

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((prev) => ({ ...prev, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const due = parseISODate(form.nextDueDate);
    const data = {
      name: form.name.trim(),
      estimatedAmount: parseFloat(form.estimatedAmount),
      cadenceMonths: resolvedCadence(form),
      // Local noon: `new Date("YYYY-MM-DD")` is UTC midnight, the previous
      // evening in Bogotá, which could move a due date into the prior month.
      nextDueDate: due ?? new Date(NaN),
      appCategoryId: form.appCategoryId,
      fundingVaultId: form.fundingVaultId,
      notes: form.notes.trim() || null,
    };
    if (!data.name || isNaN(data.estimatedAmount) || data.estimatedAmount <= 0 || !due) return;

    startTransition(async () => {
      try {
        if (isEdit && expense) await updateRecurringExpense(expense.id, data);
        else await createRecurringExpense(data);
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && handleClose()}
      title={isEdit ? "Edit recurring expense" : "New recurring expense"}
      onSubmit={handleSubmit}
      footer={
        <FormFooter hint={error ? <span className={TONE_CLASSES.danger.text}>{error}</span> : undefined}>
          <Button type="button" variant="outline" onClick={handleClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create expense"}
          </Button>
        </FormFooter>
      }
    >
      <Field label="Name" htmlFor="re-name">
        <Input id="re-name" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Car insurance" required disabled={pending} />
      </Field>
      <Field label="Estimated amount" htmlFor="re-amount">
        <MoneyInput id="re-amount" value={form.estimatedAmount} onValueChange={(v) => setField("estimatedAmount", v)} required disabled={pending} />
      </Field>
      <ScheduleFields form={form} setField={setField} context={context} disabled={pending} />
      <LinkFields form={form} setField={setField} expense={expense} recurringVaults={recurringVaults} categories={context.categories} disabled={pending} />
      <Field label="Notes" htmlFor="re-notes" optional>
        <Input id="re-notes" value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Policy number, provider…" disabled={pending} />
      </Field>
    </FormDialog>
  );
}

type SetField = <K extends keyof FormState>(k: K, v: FormState[K]) => void;

function ScheduleFields({
  form,
  setField,
  context,
  disabled,
}: {
  form: FormState;
  setField: SetField;
  context: RecurringFormContext;
  disabled: boolean;
}) {
  const amount = parseFloat(form.estimatedAmount);
  const due = parseISODate(form.nextDueDate);
  const setAside =
    amount > 0 && due ? monthlySetAside(amount, due, context.month, context.year, context.startDay) : null;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Repeats">
          <OptionSelect
            ariaLabel="Repeats"
            value={form.cadenceSelect}
            onChange={(v) => v && setField("cadenceSelect", v)}
            options={CADENCE_OPTIONS}
            disabled={disabled}
          />
        </Field>
        <Field label="Next due" htmlFor="re-due">
          <DateField id="re-due" value={form.nextDueDate} onChange={(v) => setField("nextDueDate", v)} required disabled={disabled} />
        </Field>
      </div>
      {form.cadenceSelect === "custom" && (
        <Field label="Every" htmlFor="re-custom">
          <div className="relative">
            <Input
              id="re-custom"
              inputMode="numeric"
              value={form.cadenceCustom}
              onChange={(e) => setField("cadenceCustom", e.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder="e.g. 4"
              className="pr-20 font-mono"
              disabled={disabled}
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">months</span>
          </div>
        </Field>
      )}
      {setAside !== null && (
        <FormReadout label="Set aside this month">
          <Money value={Math.round(setAside)} />
        </FormReadout>
      )}
    </>
  );
}

function LinkFields({
  form,
  setField,
  expense,
  recurringVaults,
  categories,
  disabled,
}: {
  form: FormState;
  setField: SetField;
  expense?: RecurringExpenseRow;
  recurringVaults: VaultWithMetrics[];
  categories: CategoryOption[];
  disabled: boolean;
}) {
  // An expense created before ADR-050 may carry a text label that matched no
  // category; show it so it can be linked by hand.
  const legacy = expense && !expense.appCategoryId && expense.category ? expense.category : null;
  return (
    <>
      <Field label="Category" optional hint={legacy && !form.appCategoryId ? `Was “${legacy}”. Pick a category to link it.` : undefined}>
        <OptionSelect
          ariaLabel="Category"
          value={form.appCategoryId}
          onChange={(v) => setField("appCategoryId", v)}
          noneLabel="None"
          options={categorySelectOptions(categories.filter((c) => !c.isTransfer))}
          disabled={disabled}
        />
      </Field>
      {recurringVaults.length > 0 && (
        <Field label="Funding vault" optional>
          <OptionSelect
            ariaLabel="Funding vault"
            value={form.fundingVaultId}
            onChange={(v) => setField("fundingVaultId", v)}
            noneLabel="None"
            options={recurringVaults.map((v) => ({ value: v.id, label: v.name }))}
            disabled={disabled}
          />
        </Field>
      )}
    </>
  );
}
