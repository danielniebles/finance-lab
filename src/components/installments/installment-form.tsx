"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ColorDot,
  DateField,
  Field,
  FieldGroupLabel,
  FormDialog,
  FormFooter,
  FormReadout,
  MoneyInput,
  Money,
  OptionSelect,
  SegmentedControl,
} from "@/components/ds";
import { createInstallment, updateInstallment, deleteInstallment } from "@/lib/actions/installments";
import { computeInstallmentDue, eaToMonthly, monthlyToEA } from "@/lib/installment-utils";
import { amountToDigits } from "@/lib/form-format";
import type { InstallmentRow } from "@/lib/queries/installments";

type RateType = "monthly" | "annual_ea";

type FormState = {
  description: string;
  totalAmount: string;
  numInstallments: string;
  interestRate: string; // always the value as displayed (m.v. or EA depending on rateType)
  rateType: RateType;
  startDate: string; // "YYYY-MM-DD"
  notes: string;
  cardId: string | null;
  debtorId: string | null;
  fundingAccountId: string | null;
};

const EMPTY: FormState = {
  description: "",
  totalAmount: "",
  numInstallments: "1",
  interestRate: "",
  rateType: "monthly",
  startDate: "",
  notes: "",
  cardId: null,
  debtorId: null,
  fundingAccountId: null,
};

function toFormState(row: InstallmentRow): FormState {
  const d = new Date(row.startDate);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return {
    description: row.description,
    totalAmount: amountToDigits(row.totalAmount),
    numInstallments: String(row.numInstallments),
    // stored value is always monthly — display as m.v.
    interestRate: row.monthlyInterestRate != null ? row.monthlyInterestRate.toFixed(4) : "",
    rateType: "monthly",
    startDate: `${yyyy}-${mm}-${dd}`,
    notes: row.notes ?? "",
    cardId: row.cardId,
    debtorId: row.debtorId,
    fundingAccountId: row.fundingAccountId,
  };
}

export function InstallmentForm({
  open,
  onClose,
  editing,
  cards = [],
  debtors = [],
  accounts = [],
}: {
  open: boolean;
  onClose: () => void;
  editing: InstallmentRow | null;
  cards?: { id: string; name: string; color: string | null }[];
  debtors?: { id: string; name: string }[];
  accounts?: { id: string; name: string }[];
}) {
  const [form, setForm] = useState<FormState>(() =>
    editing ? toFormState(editing) : EMPTY
  );
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Re-sync whenever the dialog transitions to open — each row now owns a
  // dedicated form instance (editing is fixed per instance), so the reset
  // needs to key off `open`, not `editing` changing.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setForm(editing ? toFormState(editing) : EMPTY);
      setConfirmingDelete(false);
    }
  }

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /** Switch rate type, converting the displayed value so the user doesn't lose context. */
  function switchRateType(next: RateType) {
    if (next === form.rateType) return;
    const current = parseFloat(form.interestRate);
    let converted = "";
    if (!isNaN(current) && current > 0) {
      if (next === "annual_ea") {
        // monthly → EA
        converted = monthlyToEA(current).toFixed(2);
      } else {
        // EA → monthly
        converted = (eaToMonthly(current) * 100).toFixed(4);
      }
    }
    setForm((prev) => ({ ...prev, rateType: next, interestRate: converted }));
  }

  /** Returns the monthly rate (% m.v.) to store, regardless of input mode. */
  function getMonthlyRate(): number | null {
    const v = parseFloat(form.interestRate);
    if (!form.interestRate.trim() || isNaN(v) || v <= 0) return null;
    if (form.rateType === "monthly") return v;
    return parseFloat((eaToMonthly(v) * 100).toFixed(4));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      description: form.description.trim(),
      totalAmount: parseFloat(form.totalAmount),
      numInstallments: parseInt(form.numInstallments, 10),
      monthlyInterestRate: getMonthlyRate(),
      startDate: new Date(form.startDate + "T12:00:00"),
      notes: form.notes.trim() || undefined,
      cardId: form.cardId,
      debtorId: form.debtorId,
      fundingAccountId: form.fundingAccountId,
    };
    if (!data.description || isNaN(data.totalAmount) || isNaN(data.numInstallments)) return;

    startTransition(async () => {
      if (editing) {
        await updateInstallment(editing.id, data);
      } else {
        await createInstallment(data);
      }
      onClose();
    });
  }

  function handleDelete() {
    if (!editing) return;
    startTransition(async () => {
      await deleteInstallment(editing.id);
      onClose();
    });
  }

  const title = confirmingDelete ? "Delete installment?" : editing ? "Edit installment" : "New installment";

  if (confirmingDelete) {
    return (
      <FormDialog
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title={title}
        footer={
          <FormFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmingDelete(false)} autoFocus>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
              Delete
            </Button>
          </FormFooter>
        }
      >
        <p className="text-sm text-muted-foreground">
          This deletes <span className="font-medium text-foreground">{editing?.description}</span> and all its
          payment records.
        </p>
      </FormDialog>
    );
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={title}
      onSubmit={handleSubmit}
      footer={
        <FormFooter>
          {editing && (
            <Button
              type="button"
              variant="destructive"
              className="sm:mr-auto"
              disabled={pending}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {editing ? "Save changes" : "Add installment"}
          </Button>
        </FormFooter>
      }
    >
      <PlanFields form={form} set={set} switchRateType={switchRateType} monthlyRate={getMonthlyRate()} />
      <LinkFields form={form} set={set} cards={cards} debtors={debtors} accounts={accounts} />
    </FormDialog>
  );
}

type SetField = <K extends keyof FormState>(field: K, value: FormState[K]) => void;

const RATE_OPTIONS = [
  { value: "monthly" as const, label: "% m.v." },
  { value: "annual_ea" as const, label: "% EA" },
];

/** First / last cuota for the readout (German amortization decreases with interest). */
function paymentPreview(form: FormState, monthlyRate: number | null) {
  const total = parseFloat(form.totalAmount);
  const n = parseInt(form.numInstallments, 10);
  if (Number.isNaN(total) || total <= 0 || Number.isNaN(n) || n <= 0) return null;
  const first = computeInstallmentDue(total, n, 1, monthlyRate);
  const last = monthlyRate && n > 1 ? computeInstallmentDue(total, n, n, monthlyRate) : null;
  return Number.isNaN(first) ? null : { first, last };
}

function PlanFields({
  form,
  set,
  switchRateType,
  monthlyRate,
}: {
  form: FormState;
  set: SetField;
  switchRateType: (next: RateType) => void;
  monthlyRate: number | null;
}) {
  const preview = paymentPreview(form, monthlyRate);
  return (
    <>
      <Field label="Description" htmlFor="inst-description">
        <Input
          id="inst-description"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="e.g. iPhone"
          required
        />
      </Field>
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3">
        <Field label="Total amount" htmlFor="inst-total">
          <MoneyInput id="inst-total" value={form.totalAmount} onValueChange={(v) => set("totalAmount", v)} required />
        </Field>
        <Field label="Installments" htmlFor="inst-count">
          <div className="relative">
            <Input
              id="inst-count"
              inputMode="numeric"
              value={form.numInstallments}
              onChange={(e) => set("numInstallments", e.target.value.replace(/\D/g, "").slice(0, 3))}
              className="pr-16 font-mono"
              required
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
              months
            </span>
          </div>
        </Field>
      </div>
      {preview && (
        <FormReadout label={preview.last !== null ? "First → last payment (decreasing)" : "Monthly payment"}>
          <Money value={preview.first} />
          {preview.last !== null && (
            <>
              {" → "}
              <Money value={preview.last} />
            </>
          )}
        </FormReadout>
      )}
      <Field
        label="Interest rate"
        htmlFor="inst-rate"
        optional
        aside={
          <SegmentedControl
            size="sm"
            ariaLabel="Rate type"
            value={form.rateType}
            onChange={switchRateType}
            options={RATE_OPTIONS}
          />
        }
        hint={
          form.rateType === "monthly"
            ? "Mensual vencido — as shown on your statement."
            : "Efectiva anual — converted to monthly for the plan."
        }
      >
        <div className="relative">
          <Input
            id="inst-rate"
            inputMode="decimal"
            value={form.interestRate}
            onChange={(e) => set("interestRate", e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))}
            placeholder={form.rateType === "monthly" ? "e.g. 1.89" : "e.g. 25.37"}
            className="pr-8 font-mono"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">%</span>
        </div>
      </Field>
      <Field label="First payment date" htmlFor="inst-start">
        <DateField id="inst-start" value={form.startDate} onChange={(v) => set("startDate", v)} required />
      </Field>
      <Field label="Notes" htmlFor="inst-notes" optional>
        <Input id="inst-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything to remember" />
      </Field>
    </>
  );
}

function LinkFields({
  form,
  set,
  cards,
  debtors,
  accounts,
}: {
  form: FormState;
  set: SetField;
  cards: { id: string; name: string; color: string | null }[];
  debtors: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
}) {
  return (
    <>
      <FieldGroupLabel>Optional links</FieldGroupLabel>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Credit card">
          <OptionSelect
            ariaLabel="Credit card"
            value={form.cardId}
            onChange={(v) => set("cardId", v)}
            noneLabel="None"
            options={cards.map((c) => ({ value: c.id, label: c.name, leading: <ColorDot color={c.color} /> }))}
          />
        </Field>
        <Field label="For debtor">
          <OptionSelect
            ariaLabel="For debtor"
            value={form.debtorId}
            onChange={(v) => {
              set("debtorId", v);
              if (!v) set("fundingAccountId", null);
            }}
            noneLabel="None"
            options={debtors.map((d) => ({ value: d.id, label: d.name }))}
          />
        </Field>
      </div>
      {form.debtorId && (
        <Field label="Funding account" hint="The account you paid from. Each cuota paid creates a loan under this debtor.">
          <OptionSelect
            ariaLabel="Funding account"
            value={form.fundingAccountId}
            onChange={(v) => set("fundingAccountId", v)}
            noneLabel="None"
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          />
        </Field>
      )}
    </>
  );
}
