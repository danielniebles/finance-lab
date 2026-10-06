"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckField,
  ColorPicker,
  DateField,
  Field,
  FieldGroupLabel,
  FormDialog,
  FormFooter,
  MoneyInput,
  SegmentedControl,
} from "@/components/ds";
import { createAccount, updateAccount } from "@/lib/actions/loans";
import { AccountType } from "@/generated/prisma";
import { DEFAULT_ENTITY_COLOR } from "@/lib/color-presets";
import { localISODate, parseISODate } from "@/lib/form-format";
import { TONE_CLASSES } from "@/lib/status";
import type { AccountWithBalance } from "@/lib/queries/loans";

const TYPE_OPTIONS = [
  { value: AccountType.BANK, label: "Bank" },
  { value: AccountType.DIGITAL, label: "Digital" },
  { value: AccountType.PENSION, label: "Pension" },
];

type FormState = {
  name: string;
  accountType: AccountType;
  color: string;
  includeInAvailable: boolean;
  includeInOverviewTotal: boolean;
  initialBalance: string; // digits
  initialDate: string; // YYYY-MM-DD
};

function initialState(editing: AccountWithBalance | null): FormState {
  return {
    name: editing?.name ?? "",
    accountType: (editing?.accountType as AccountType) ?? AccountType.BANK,
    color: editing?.color ?? DEFAULT_ENTITY_COLOR,
    includeInAvailable: editing?.includeInAvailable ?? true,
    includeInOverviewTotal: editing?.includeInOverviewTotal ?? true,
    initialBalance: "",
    // Local "today": the UTC date is already tomorrow after 7pm in Bogotá.
    initialDate: localISODate(new Date()),
  };
}

type SetField = <K extends keyof FormState>(k: K, v: FormState[K]) => void;

/** Inner form — keyed so it remounts fresh for each account and each open. */
function AccountFormInner({ open, editing, onClose }: { open: boolean; editing: AccountWithBalance | null; onClose: () => void }) {
  const [form, setForm] = useState<FormState>(() => initialState(editing));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const setField: SetField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const base = {
      name: form.name.trim(),
      accountType: form.accountType,
      color: form.color,
      includeInAvailable: form.includeInAvailable,
      includeInOverviewTotal: form.includeInOverviewTotal,
    };
    if (!base.name) return;
    setError(null);
    startTransition(async () => {
      try {
        if (editing) await updateAccount(editing.id, base);
        else
          await createAccount({
            ...base,
            initialBalance: form.initialBalance ? parseFloat(form.initialBalance) : undefined,
            initialDate: parseISODate(form.initialDate) ?? undefined,
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
      title={editing ? `Edit ${editing.name}` : "New savings account"}
      onSubmit={handleSubmit}
      footer={
        <FormFooter hint={error ? <span className={TONE_CLASSES.danger.text}>{error}</span> : undefined}>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !form.name.trim()}>
            {pending ? "Saving…" : editing ? "Save changes" : "Add account"}
          </Button>
        </FormFooter>
      }
    >
      <Field label="Name" htmlFor="acc-name">
        <Input id="acc-name" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Bancolombia" required disabled={pending} />
      </Field>
      <Field label="Type" hint={form.accountType === AccountType.PENSION ? "Pension (AFP) money you can't take out freely." : undefined}>
        <SegmentedControl ariaLabel="Account type" value={form.accountType} onChange={(v) => setField("accountType", v)} options={TYPE_OPTIONS} />
      </Field>
      <Field label="Colour">
        <ColorPicker value={form.color} onChange={(c) => setField("color", c ?? DEFAULT_ENTITY_COLOR)} disabled={pending} />
      </Field>
      <IncludeFields form={form} setField={setField} disabled={pending} />
      {!editing && <OpeningBalanceFields form={form} setField={setField} disabled={pending} />}
    </FormDialog>
  );
}

function IncludeFields({ form, setField, disabled }: { form: FormState; setField: SetField; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <FieldGroupLabel>Counts toward</FieldGroupLabel>
      <CheckField
        id="acc-available"
        label="Available balance"
        hint="Money you can use now, on Savings & Loans."
        checked={form.includeInAvailable}
        onChange={(v) => setField("includeInAvailable", v)}
        disabled={disabled}
      />
      <CheckField
        id="acc-total"
        label="Total balance on Home"
        checked={form.includeInOverviewTotal}
        onChange={(v) => setField("includeInOverviewTotal", v)}
        disabled={disabled}
      />
    </div>
  );
}

function OpeningBalanceFields({ form, setField, disabled }: { form: FormState; setField: SetField; disabled: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Opening balance" htmlFor="acc-balance" optional>
        <MoneyInput id="acc-balance" value={form.initialBalance} onValueChange={(v) => setField("initialBalance", v)} disabled={disabled} />
      </Field>
      <Field label="As of" htmlFor="acc-date">
        <DateField id="acc-date" value={form.initialDate} onChange={(v) => setField("initialDate", v)} disabled={disabled} />
      </Field>
    </div>
  );
}

export function AccountForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: AccountWithBalance | null;
}) {
  // A new key on every open: the form starts from the saved values each time
  // (a cancelled edit or a half-typed new account doesn't come back).
  const [session, setSession] = useState(0);
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setSession((n) => n + 1);
  }
  return <AccountFormInner key={`${editing?.id ?? "new"}-${session}`} open={open} editing={editing} onClose={onClose} />;
}
