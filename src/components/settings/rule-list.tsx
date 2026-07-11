"use client";

import { useState, useTransition } from "react";
import {
  createCounterpartyRule,
  updateCounterpartyRule,
  deleteCounterpartyRule,
} from "@/lib/actions/counterparty-rules";
import type { RuleMatchType, RuleDirection } from "@/generated/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";

export type CounterpartyRuleRowData = {
  id: string;
  matchType: RuleMatchType;
  matchValue: string;
  direction: RuleDirection;
  appCategoryId: string;
  appCategoryName: string;
  wallet: string;
  autoRecord: boolean;
  recurring: boolean;
  expectedAmount: number | null;
  notes: string | null;
  matchCount: number;
  lastMatchedAt: Date | null;
  createdAt: Date;
};

type CategoryOption = { id: string; name: string };

const MATCH_TYPE_LABELS: Record<RuleMatchType, string> = {
  ACCOUNT: "Account",
  MERCHANT: "Merchant",
  SENDER: "Sender",
  KEYWORD: "Keyword",
};

const MATCH_TYPE_HINTS: Record<RuleMatchType, string> = {
  ACCOUNT: "Account number",
  MERCHANT: "Merchant name",
  SENDER: "Sender name",
  KEYWORD: "Keyword",
};

const DIRECTION_LABELS: Record<RuleDirection, string> = {
  EXPENSE: "Expense",
  INCOME: "Income",
  ANY: "Any",
};

function formatLastMatched(date: Date | null): string {
  if (!date) return "Never";
  return new Date(date).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ToggleField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded"
      />
      <Label htmlFor={id} className="font-normal cursor-pointer">
        {label}
      </Label>
    </div>
  );
}

function MatchTypeSelect({
  value,
  onChange,
}: {
  value: RuleMatchType;
  onChange: (v: RuleMatchType) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as RuleMatchType)}>
      <SelectTrigger className="h-8 w-32">
        <span className="text-sm">{MATCH_TYPE_LABELS[value]}</span>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(MATCH_TYPE_LABELS) as RuleMatchType[]).map((t) => (
          <SelectItem key={t} value={t}>
            {MATCH_TYPE_LABELS[t]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DirectionSelect({
  value,
  onChange,
}: {
  value: RuleDirection;
  onChange: (v: RuleDirection) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as RuleDirection)}>
      <SelectTrigger className="h-8 w-24">
        <span className="text-sm">{DIRECTION_LABELS[value]}</span>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(DIRECTION_LABELS) as RuleDirection[]).map((d) => (
          <SelectItem key={d} value={d}>
            {DIRECTION_LABELS[d]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CategorySelect({
  value,
  categories,
  onChange,
}: {
  value: string;
  categories: CategoryOption[];
  onChange: (v: string) => void;
}) {
  const selected = categories.find((c) => c.id === value);
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="h-8 w-36">
        <span className="text-sm truncate">
          {selected?.name ?? <span className="text-muted-foreground">Select…</span>}
        </span>
      </SelectTrigger>
      <SelectContent>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export type RuleFormValues = {
  matchType: RuleMatchType;
  matchValue: string;
  direction: RuleDirection;
  appCategoryId: string;
  wallet: string;
  autoRecord: boolean;
  recurring: boolean;
  expectedAmount: string;
  notes: string;
};

function emptyFormValues(): RuleFormValues {
  return {
    matchType: "ACCOUNT",
    matchValue: "",
    direction: "ANY",
    appCategoryId: "",
    wallet: "",
    autoRecord: true,
    recurring: false,
    expectedAmount: "",
    notes: "",
  };
}

function formValuesFromRule(rule: CounterpartyRuleRowData): RuleFormValues {
  return {
    matchType: rule.matchType,
    matchValue: rule.matchValue,
    direction: rule.direction,
    appCategoryId: rule.appCategoryId,
    wallet: rule.wallet,
    autoRecord: rule.autoRecord,
    recurring: rule.recurring,
    expectedAmount: rule.expectedAmount != null ? String(rule.expectedAmount) : "",
    notes: rule.notes ?? "",
  };
}

function defaultFormValues(rule?: CounterpartyRuleRowData): RuleFormValues {
  return rule ? formValuesFromRule(rule) : emptyFormValues();
}

function RuleFormFields({
  values,
  categories,
  onChange,
}: {
  values: RuleFormValues;
  categories: CategoryOption[];
  onChange: (patch: Partial<RuleFormValues>) => void;
}) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-2 flex-wrap">
        <MatchTypeSelect
          value={values.matchType}
          onChange={(matchType) => onChange({ matchType })}
        />
        <div className="flex flex-col gap-0.5">
          <Input
            value={values.matchValue}
            onChange={(e) => onChange({ matchValue: e.target.value })}
            placeholder={MATCH_TYPE_HINTS[values.matchType]}
            className="h-8 w-40 text-sm"
            required
          />
          <span className="text-xs text-muted-foreground pl-1">
            {MATCH_TYPE_HINTS[values.matchType]}
          </span>
        </div>
        <DirectionSelect value={values.direction} onChange={(direction) => onChange({ direction })} />
        <CategorySelect
          value={values.appCategoryId}
          categories={categories}
          onChange={(appCategoryId) => onChange({ appCategoryId })}
        />
        <Input
          value={values.wallet}
          onChange={(e) => onChange({ wallet: e.target.value })}
          placeholder="Wallet"
          className="h-8 w-32 text-sm"
          required
        />
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <ToggleField
          id="autoRecord"
          label="Auto-record"
          checked={values.autoRecord}
          onChange={(autoRecord) => onChange({ autoRecord })}
        />
        <ToggleField
          id="recurring"
          label="Recurring"
          checked={values.recurring}
          onChange={(recurring) => onChange({ recurring })}
        />
        {values.recurring && (
          <Input
            type="number"
            value={values.expectedAmount}
            onChange={(e) => onChange({ expectedAmount: e.target.value })}
            placeholder="Expected amount"
            className="h-8 w-32 text-sm font-mono"
          />
        )}
        <Input
          value={values.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Notes (optional)"
          className="h-8 w-40 text-sm"
        />
      </div>
    </div>
  );
}

function buildPayload(values: RuleFormValues) {
  return {
    matchType: values.matchType,
    matchValue: values.matchValue,
    direction: values.direction,
    appCategoryId: values.appCategoryId,
    wallet: values.wallet,
    autoRecord: values.autoRecord,
    recurring: values.recurring,
    // Only submit expectedAmount when recurring is on — the input is hidden
    // (and stale) once recurring is toggled off, so never trust leftover
    // local state for it here.
    expectedAmount:
      values.recurring && values.expectedAmount ? parseFloat(values.expectedAmount) : undefined,
    notes: values.notes || undefined,
  };
}

function RuleRow({ rule, categories }: { rule: CounterpartyRuleRowData; categories: CategoryOption[] }) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<RuleFormValues>(() => defaultFormValues(rule));
  const [pending, startTransition] = useTransition();

  function handlePatch(patch: Partial<RuleFormValues>) {
    setValues((v) => ({ ...v, ...patch }));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateCounterpartyRule(rule.id, buildPayload(values));
      setEditing(false);
    });
  }

  function handleDelete() {
    if (!confirm(`Delete this rule for "${rule.matchValue}"?`)) return;
    startTransition(() => deleteCounterpartyRule(rule.id));
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border last:border-0">
        <RuleFormFields values={values} categories={categories} onChange={handlePatch} />
        <div className="flex gap-1 shrink-0 pt-1">
          <Button type="submit" size="icon" className="size-7" disabled={pending} aria-label="Save rule">
            <Check className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Cancel editing"
            onClick={() => {
              setValues(defaultFormValues(rule));
              setEditing(false);
            }}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-0 group/rulerow">
      <div className="flex items-center gap-3 flex-wrap min-w-0">
        <span className="inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {MATCH_TYPE_LABELS[rule.matchType]}
        </span>
        <span className="text-sm font-medium truncate">{rule.matchValue}</span>
        <span className="text-xs text-muted-foreground">{DIRECTION_LABELS[rule.direction]}</span>
        <span className="text-muted-foreground text-sm">→</span>
        <span className="text-sm">{rule.appCategoryName}</span>
        <span className="text-xs text-muted-foreground">· {rule.wallet}</span>
        {rule.autoRecord && (
          <span className="inline-flex w-fit items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
            Auto-record
          </span>
        )}
        {rule.recurring && (
          <span className="inline-flex w-fit items-center rounded-full bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
            Recurring
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {rule.matchCount} match{rule.matchCount !== 1 ? "es" : ""}
        </span>
        <span className="text-xs text-muted-foreground">{formatLastMatched(rule.lastMatchedAt)}</span>
      </div>
      <div className="flex gap-1 opacity-0 group-hover/rulerow:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Edit rule"
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-destructive hover:text-destructive"
          aria-label="Delete rule"
          onClick={handleDelete}
          disabled={pending}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function AddRuleRow({
  categories,
  onDone,
}: {
  categories: CategoryOption[];
  onDone: () => void;
}) {
  const [values, setValues] = useState<RuleFormValues>(() => defaultFormValues());
  const [pending, startTransition] = useTransition();

  function handlePatch(patch: Partial<RuleFormValues>) {
    setValues((v) => ({ ...v, ...patch }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await createCounterpartyRule(buildPayload(values));
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start justify-between gap-3 p-4 border-t border-border">
      <RuleFormFields values={values} categories={categories} onChange={handlePatch} />
      <div className="flex gap-1 shrink-0 pt-1">
        <Button type="submit" size="icon" className="size-8" disabled={pending} aria-label="Create rule">
          <Check className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Cancel"
          onClick={onDone}
        >
          <X className="size-4" />
        </Button>
      </div>
    </form>
  );
}

export function RuleList({
  rules,
  categories,
}: {
  rules: CounterpartyRuleRowData[];
  categories: CategoryOption[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {rules.map((rule) => (
        <RuleRow key={rule.id} rule={rule} categories={categories} />
      ))}

      {rules.length === 0 && !adding && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          No rules yet. Add one below.
        </div>
      )}

      {adding ? (
        <AddRuleRow categories={categories} onDone={() => setAdding(false)} />
      ) : (
        <div className="p-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-5" />
            Add rule
          </Button>
        </div>
      )}
    </div>
  );
}
