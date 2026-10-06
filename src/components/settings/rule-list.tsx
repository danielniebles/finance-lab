"use client";

import { useState, useTransition } from "react";
import {
  createCounterpartyRule,
  updateCounterpartyRule,
  deleteCounterpartyRule,
} from "@/lib/actions/counterparty-rules";
import type { RuleMatchType, RuleDirection } from "@/generated/prisma";
import { Button } from "@/components/ui/button";
import { HeaderAction } from "@/components/ds";
import { Input } from "@/components/ui/input";
import { CheckField, Field, FormDialog, FormFooter, MoneyInput, OptionSelect, SegmentedControl, StatusChip } from "@/components/ds";
import { CategoryIconTile, categorySelectOptions } from "@/components/shared/category-option";
import { amountToDigits, formatDateLabel, localISODate } from "@/lib/form-format";
import { MATCH_TYPE_LABELS, MATCH_VALUE_FIELD, ruleMissingHint } from "@/lib/settings-forms";
import { TONE_CLASSES } from "@/lib/status";
import { cn } from "@/lib/utils";

export type CounterpartyRuleRowData = {
  id: string;
  matchType: RuleMatchType;
  matchValue: string;
  direction: RuleDirection;
  appCategoryId: string;
  appCategoryName: string;
  wallet: string;
  // Curated Wallet.id this rule routes to (ADR-036/037-style upgrade). Null
  // until backfilled — the form then asks for a wallet before saving.
  walletId: string | null;
  autoRecord: boolean;
  recurring: boolean;
  expectedAmount: number | null;
  notes: string | null;
  matchCount: number;
  lastMatchedAt: Date | null;
  createdAt: Date;
};

type CategoryOption = { id: string; name: string; icon?: string | null; color?: string | null; isTransfer?: boolean };
type WalletOption = { id: string; name: string };

const MATCH_TYPE_OPTIONS = (Object.keys(MATCH_TYPE_LABELS) as RuleMatchType[]).map((t) => ({ value: t, label: MATCH_TYPE_LABELS[t] }));

const DIRECTION_OPTIONS: { value: RuleDirection; label: string }[] = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
  { value: "ANY", label: "Any" },
];

const DIRECTION_LABELS: Record<RuleDirection, string> = { EXPENSE: "Expense", INCOME: "Income", ANY: "Any" };

/** "Today, Oct 6" · "Aug 24" · "Mar 2, 2025": the short form used across the app. */
function formatLastMatched(date: Date | null): string {
  if (!date) return "Never";
  return formatDateLabel(localISODate(new Date(date)));
}

export type RuleFormValues = {
  matchType: RuleMatchType;
  matchValue: string;
  direction: RuleDirection;
  appCategoryId: string;
  walletId: string;
  autoRecord: boolean;
  recurring: boolean;
  expectedAmount: string; // digits
  notes: string;
};

function defaultFormValues(rule?: CounterpartyRuleRowData): RuleFormValues {
  if (!rule) {
    return { matchType: "ACCOUNT", matchValue: "", direction: "ANY", appCategoryId: "", walletId: "", autoRecord: true, recurring: false, expectedAmount: "", notes: "" };
  }
  return {
    matchType: rule.matchType,
    matchValue: rule.matchValue,
    direction: rule.direction,
    appCategoryId: rule.appCategoryId,
    walletId: rule.walletId ?? "",
    autoRecord: rule.autoRecord,
    recurring: rule.recurring,
    expectedAmount: rule.expectedAmount != null ? amountToDigits(rule.expectedAmount) : "",
    notes: rule.notes ?? "",
  };
}

// The actions still require the legacy `wallet` name (resolveWalletFields
// writes it back for older readers); walletId wins server-side anyway.
// null (not undefined) for expectedAmount and notes: on edit, turning off
// "recurring" or emptying the notes has to clear the stored value —
// undefined left the old one in place.
function buildPayload(values: RuleFormValues, walletOptions: WalletOption[]) {
  return {
    matchType: values.matchType,
    matchValue: values.matchValue.trim(),
    direction: values.direction,
    appCategoryId: values.appCategoryId,
    wallet: walletOptions.find((w) => w.id === values.walletId)?.name ?? "",
    walletId: values.walletId || undefined,
    autoRecord: values.autoRecord,
    recurring: values.recurring,
    expectedAmount: values.recurring && values.expectedAmount ? parseFloat(values.expectedAmount) : null,
    notes: values.notes.trim() || null,
  };
}

type Patch = (patch: Partial<RuleFormValues>) => void;

function MatchFields({ values, onChange, disabled }: { values: RuleFormValues; onChange: Patch; disabled: boolean }) {
  const field = MATCH_VALUE_FIELD[values.matchType];
  return (
    <>
      <Field label="Match by">
        <SegmentedControl ariaLabel="Match by" value={values.matchType} onChange={(matchType) => onChange({ matchType })} options={MATCH_TYPE_OPTIONS} />
      </Field>
      <Field label={field.label} htmlFor="rule-value" hint={field.hint}>
        <Input
          id="rule-value"
          value={values.matchValue}
          onChange={(e) => onChange({ matchValue: e.target.value })}
          placeholder={field.placeholder}
          inputMode={values.matchType === "ACCOUNT" ? "numeric" : undefined}
          className={values.matchType === "ACCOUNT" ? "font-mono" : undefined}
          required
          disabled={disabled}
        />
      </Field>
      <Field label="Applies to">
        <SegmentedControl ariaLabel="Applies to" value={values.direction} onChange={(direction) => onChange({ direction })} options={DIRECTION_OPTIONS} />
      </Field>
    </>
  );
}

function RouteFields({
  values,
  categories,
  walletOptions,
  onChange,
  disabled,
}: {
  values: RuleFormValues;
  categories: CategoryOption[];
  walletOptions: WalletOption[];
  onChange: Patch;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Category">
        <OptionSelect
          ariaLabel="Category"
          value={values.appCategoryId || null}
          onChange={(v) => onChange({ appCategoryId: v ?? "" })}
          placeholder="Pick a category…"
          options={categorySelectOptions(categories.filter((c) => !c.isTransfer))}
          disabled={disabled}
        />
      </Field>
      <Field label="Wallet">
        <OptionSelect
          ariaLabel="Wallet"
          value={values.walletId || null}
          onChange={(v) => onChange({ walletId: v ?? "" })}
          placeholder="Pick a wallet…"
          options={walletOptions.map((w) => ({ value: w.id, label: w.name }))}
          disabled={disabled}
        />
      </Field>
    </div>
  );
}

function BehaviourFields({ values, onChange, disabled }: { values: RuleFormValues; onChange: Patch; disabled: boolean }) {
  return (
    <div className="flex flex-col">
      <CheckField
        id="rule-auto"
        label="Auto-record"
        hint="Matching messages are saved right away instead of waiting for review."
        checked={values.autoRecord}
        onChange={(autoRecord) => onChange({ autoRecord })}
        disabled={disabled}
      />
      <CheckField
        id="rule-recurring"
        label="Recurring"
        checked={values.recurring}
        onChange={(recurring) => onChange({ recurring })}
        disabled={disabled}
      />
      {values.recurring && (
        <Field label="Expected amount" htmlFor="rule-expected" optional className="mt-2">
          <MoneyInput id="rule-expected" value={values.expectedAmount} onValueChange={(expectedAmount) => onChange({ expectedAmount })} disabled={disabled} />
        </Field>
      )}
    </div>
  );
}

function footerHint(error: string | null, pending: boolean, missing: string): React.ReactNode {
  if (error) return <span className={TONE_CLASSES.danger.text}>{error}</span>;
  return pending ? "" : missing;
}

function DeleteRuleStep({ rule, open, onClose, onBack }: { rule: CounterpartyRuleRowData; open: boolean; onClose: () => void; onBack: () => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Delete rule?"
      footer={
        <FormFooter>
          <Button type="button" variant="outline" onClick={onBack} autoFocus>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteCounterpartyRule(rule.id);
                onClose();
              })
            }
          >
            Confirm delete
          </Button>
        </FormFooter>
      }
    >
      <p className="text-sm text-muted-foreground">
        Delete this rule for &quot;{rule.matchValue}&quot;? Future matching messages go back to review instead of being
        routed automatically.
      </p>
    </FormDialog>
  );
}

/** New rule, or edit / delete one (`rule`). */
function RuleDialog({
  rule,
  categories,
  walletOptions,
  open,
  onClose,
}: {
  rule?: CounterpartyRuleRowData;
  categories: CategoryOption[];
  walletOptions: WalletOption[];
  open: boolean;
  onClose: () => void;
}) {
  const [values, setValues] = useState<RuleFormValues>(() => defaultFormValues(rule));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setValues(defaultFormValues(rule));
      setError(null);
      setConfirmingDelete(false);
    }
  }

  const onChange: Patch = (patch) => setValues((v) => ({ ...v, ...patch }));
  const missing = ruleMissingHint(values);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (missing) return;
    setError(null);
    const payload = buildPayload(values, walletOptions);
    startTransition(async () => {
      try {
        if (rule) await updateCounterpartyRule(rule.id, payload);
        else await createCounterpartyRule(payload);
        onClose();
      } catch {
        setError("Couldn't save the rule. Try again.");
      }
    });
  }

  if (confirmingDelete && rule) {
    return <DeleteRuleStep rule={rule} open={open} onClose={onClose} onBack={() => setConfirmingDelete(false)} />;
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={rule ? "Edit rule" : "New rule"}
      size="lg"
      onSubmit={handleSave}
      footer={
        <FormFooter hint={footerHint(error, pending, missing)}>
          {rule && (
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
            {pending ? "Saving…" : rule ? "Save rule" : "Create rule"}
          </Button>
        </FormFooter>
      }
    >
      <MatchFields values={values} onChange={onChange} disabled={pending} />
      <RouteFields values={values} categories={categories} walletOptions={walletOptions} onChange={onChange} disabled={pending} />
      <BehaviourFields values={values} onChange={onChange} disabled={pending} />
      <Field label="Notes" htmlFor="rule-notes" optional>
        <Input id="rule-notes" value={values.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Who this is, why it's routed here…" disabled={pending} />
      </Field>
    </FormDialog>
  );
}

// One markup for phone and desktop. Phones: match + type on the first line,
// category → wallet and flags below. sm+: columns.
const ROW_GRID = "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_9rem_6.5rem]";

function RuleRow({ rule, categories, walletOptions }: { rule: CounterpartyRuleRowData; categories: CategoryOption[]; walletOptions: WalletOption[] }) {
  const [editOpen, setEditOpen] = useState(false);
  const category = categories.find((c) => c.id === rule.appCategoryId);
  return (
    <li>
      <button type="button" aria-label="Edit rule" onClick={() => setEditOpen(true)} className={cn(ROW_GRID, "w-full text-left transition-colors hover:bg-muted/20")}>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{rule.matchValue}</span>
          <span className="block text-xs text-muted-foreground">
            {MATCH_TYPE_LABELS[rule.matchType]} · {DIRECTION_LABELS[rule.direction]}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-sm max-sm:col-span-2 max-sm:row-start-2">
          <CategoryIconTile category={category ?? { name: rule.appCategoryName }} />
          <span className="truncate">{rule.appCategoryName}</span>
          <span className="truncate text-muted-foreground">· {rule.wallet}</span>
        </span>
        <span className="flex flex-wrap gap-1 max-sm:col-span-2 max-sm:row-start-3">
          {rule.autoRecord && <StatusChip tone="info">Auto-record</StatusChip>}
          {rule.recurring && <StatusChip tone="neutral">Recurring</StatusChip>}
        </span>
        <span className="text-right text-xs text-muted-foreground max-sm:col-start-2 max-sm:row-start-1">
          <span className="block">
            {rule.matchCount} match{rule.matchCount !== 1 ? "es" : ""}
          </span>
          <span className="block">{formatLastMatched(rule.lastMatchedAt)}</span>
        </span>
      </button>
      <RuleDialog rule={rule} categories={categories} walletOptions={walletOptions} open={editOpen} onClose={() => setEditOpen(false)} />
    </li>
  );
}

export function RuleList({
  rules,
  categories,
  walletOptions,
}: {
  rules: CounterpartyRuleRowData[];
  categories: CategoryOption[];
  walletOptions: WalletOption[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        {rules.length > 0 && (
          <div className={cn(ROW_GRID, "hidden border-b border-border/60 py-2 text-xs tracking-wide text-muted-foreground uppercase sm:grid")}>
            <span>Match</span>
            <span>Routes to</span>
            <span>Flags</span>
            <span className="text-right">Activity</span>
          </div>
        )}
        <ul className="divide-y divide-border/40">
          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} categories={categories} walletOptions={walletOptions} />
          ))}
          {rules.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No rules yet.</li>}
        </ul>
      </div>
    </div>
  );
}

/** The page's main action: opens a new-rule dialog. */
export function AddRuleButton({ categories, walletOptions }: { categories: CategoryOption[]; walletOptions: WalletOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <HeaderAction label="Add rule" onClick={() => setOpen(true)} />
      <RuleDialog categories={categories} walletOptions={walletOptions} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
