"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ColorPicker,
  DateField,
  Field,
  FormDialog,
  FormFooter,
  FormReadout,
  Money,
  MoneyInput,
  SegmentedControl,
} from "@/components/ds";
import { createVault, updateVault, archiveVault } from "@/lib/actions/vaults";
import { dateInputValue } from "@/lib/format";
import { amountToDigits, parseISODate } from "@/lib/form-format";
import { TONE_CLASSES } from "@/lib/status";
import { deadlinePlan } from "@/lib/vault-display";
import type { VaultKind, VaultGoalType } from "@/generated/prisma";
import type { VaultWithMetrics } from "@/lib/queries/vaults";
import type { VaultPeriod } from "@/lib/vault-utils";

type FormState = {
  name: string;
  kind: VaultKind;
  goalType: VaultGoalType;
  targetAmount: string; // digits
  targetDate: string; // YYYY-MM-DD
  color: string | null;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  kind: "LEISURE",
  goalType: "FIXED_DEADLINE",
  targetAmount: "",
  targetDate: "",
  color: null,
  notes: "",
};

function toFormState(vault: VaultWithMetrics): FormState {
  return {
    name: vault.name,
    kind: vault.kind,
    goalType: vault.goalType,
    targetAmount: amountToDigits(vault.targetAmount),
    // UTC read on purpose (see dateInputValue): older rows are UTC midnight.
    targetDate: vault.targetDate ? dateInputValue(new Date(vault.targetDate)) : "",
    color: vault.color,
    notes: vault.notes ?? "",
  };
}

const KIND_OPTIONS = [
  { value: "MANDATORY" as const, label: "Mandatory" },
  { value: "LEISURE" as const, label: "Leisure" },
];

const GOAL_OPTIONS = [
  { value: "FIXED_DEADLINE" as const, label: "Deadline" },
  { value: "OPEN_ENDED" as const, label: "Open-ended" },
  { value: "RECURRING" as const, label: "Sinking fund" },
];

const GOAL_HINT: Record<VaultGoalType, string> = {
  FIXED_DEADLINE: "Save a target amount by a date.",
  OPEN_ENDED: "Save at your own pace, no target or date.",
  RECURRING: "Funded by linked recurring expenses; the monthly set-aside is computed for you.",
};

type Props = {
  open: boolean;
  mode: "create" | "edit";
  vault?: VaultWithMetrics | null;
  onClose: () => void;
  /** Current financial month, for the "per month" preview. */
  period: VaultPeriod;
};

export function VaultForm({ open, mode, vault, onClose, period }: Props) {
  const [form, setForm] = useState<FormState>(() => (mode === "edit" && vault ? toFormState(vault) : EMPTY_FORM));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  function handleClose() {
    setForm(EMPTY_FORM);
    setError(null);
    setConfirmingArchive(false);
    onClose();
  }

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((prev) => ({ ...prev, [k]: v }));

  function run(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const deadline = form.goalType === "FIXED_DEADLINE";
    const data = {
      name: form.name.trim(),
      kind: form.kind,
      goalType: form.goalType,
      targetAmount: deadline && form.targetAmount ? parseFloat(form.targetAmount) : null,
      // Local noon, not `new Date("YYYY-MM-DD")` (UTC midnight = the evening before in Bogotá).
      targetDate: deadline ? parseISODate(form.targetDate) : null,
      color: form.color,
      notes: form.notes.trim() || null,
    };
    if (!data.name) return;
    run(() => (mode === "edit" && vault ? updateVault(vault.id, data) : createVault(data)));
  }

  const errorHint = error ? <span className={TONE_CLASSES.danger.text}>{error}</span> : undefined;

  if (confirmingArchive && vault) {
    return (
      <FormDialog
        open={open}
        onOpenChange={(o) => !o && handleClose()}
        title="Archive vault?"
        footer={
          <FormFooter hint={errorHint}>
            <Button type="button" variant="outline" onClick={() => setConfirmingArchive(false)} autoFocus>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={() => run(() => archiveVault(vault.id))}>
              Archive
            </Button>
          </FormFooter>
        }
      >
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{vault.name}</span> will be hidden from the dashboard. Its
          entries are kept.
        </p>
      </FormDialog>
    );
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && handleClose()}
      title={mode === "create" ? "New vault" : "Edit vault"}
      onSubmit={handleSubmit}
      footer={
        <FormFooter hint={errorHint}>
          {mode === "edit" && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
              onClick={() => setConfirmingArchive(true)}
              disabled={pending}
            >
              Archive
            </Button>
          )}
          <Button type="button" variant="outline" onClick={handleClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : mode === "create" ? "Create vault" : "Save changes"}
          </Button>
        </FormFooter>
      }
    >
      <Field label="Name" htmlFor="vault-name">
        <Input id="vault-name" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Emergency fund" required disabled={pending} />
      </Field>
      <Field label="Kind" hint={form.kind === "MANDATORY" ? "Funded first: shown as a gap until it's covered." : undefined}>
        <SegmentedControl ariaLabel="Vault kind" value={form.kind} onChange={(v) => setField("kind", v)} options={KIND_OPTIONS} />
      </Field>
      <Field label="Goal" hint={GOAL_HINT[form.goalType]}>
        <SegmentedControl ariaLabel="Goal type" value={form.goalType} onChange={(v) => setField("goalType", v)} options={GOAL_OPTIONS} />
      </Field>
      {form.goalType === "FIXED_DEADLINE" && (
        <DeadlineFields form={form} setField={setField} balance={vault?.balance ?? 0} period={period} disabled={pending} />
      )}
      <Field label="Colour" optional>
        <ColorPicker value={form.color} onChange={(c) => setField("color", c)} allowNone disabled={pending} />
      </Field>
      <Field label="Notes" htmlFor="vault-notes" optional>
        <Input id="vault-notes" value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="What are you saving for?" disabled={pending} />
      </Field>
    </FormDialog>
  );
}

function DeadlineFields({
  form,
  setField,
  balance,
  period,
  disabled,
}: {
  form: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  balance: number;
  period: VaultPeriod;
  disabled: boolean;
}) {
  const target = parseFloat(form.targetAmount);
  const deadline = parseISODate(form.targetDate);
  const plan = target > 0 && deadline ? deadlinePlan(target, balance, deadline, period) : null;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target" htmlFor="vault-target">
          <MoneyInput id="vault-target" value={form.targetAmount} onValueChange={(v) => setField("targetAmount", v)} required disabled={disabled} />
        </Field>
        <Field label="Deadline" htmlFor="vault-deadline">
          <DateField id="vault-deadline" value={form.targetDate} onChange={(v) => setField("targetDate", v)} required disabled={disabled} />
        </Field>
      </div>
      {plan && (
        <FormReadout
          label={`To save per month · ${plan.months} ${plan.months === 1 ? "month" : "months"} left`}
        >
          <Money value={Math.ceil(plan.perMonth)} />
        </FormReadout>
      )}
    </>
  );
}
