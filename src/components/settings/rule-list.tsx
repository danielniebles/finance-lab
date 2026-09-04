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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Check, X } from "lucide-react";
import { WalletSelect } from "@/components/shared/wallet-select";
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
  // until backfilled/resolved — see WalletSelect's placeholder fallback.
  walletId: string | null;
  autoRecord: boolean;
  recurring: boolean;
  expectedAmount: number | null;
  notes: string | null;
  matchCount: number;
  lastMatchedAt: Date | null;
  createdAt: Date;
};

type CategoryOption = { id: string; name: string };
type WalletOption = { id: string; name: string };

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
  walletId: string;
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
    walletId: "",
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
    walletId: rule.walletId ?? "",
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
  walletOptions,
  onChange,
}: {
  values: RuleFormValues;
  categories: CategoryOption[];
  walletOptions: WalletOption[];
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
        <div className="flex flex-col gap-0.5">
          <WalletSelect
            value={values.walletId}
            options={walletOptions}
            onChange={(walletId) => onChange({ walletId })}
            className="h-8 w-32"
            invalid={values.walletId === ""}
          />
          {values.walletId === "" && (
            <span className="text-xs text-destructive pl-1">Select a wallet to save</span>
          )}
        </div>
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

// createCounterpartyRule/updateCounterpartyRule still require a `wallet`
// name (resolveWalletFields writes it back for every other reader of that
// legacy column), so the curated walletId's name is resolved here and sent
// alongside it — walletId wins server-side and overwrites `wallet` anyway
// (see resolve-wallet.ts), this just satisfies the required field.
function buildPayload(values: RuleFormValues, walletOptions: WalletOption[]) {
  return {
    matchType: values.matchType,
    matchValue: values.matchValue,
    direction: values.direction,
    appCategoryId: values.appCategoryId,
    wallet: walletOptions.find((w) => w.id === values.walletId)?.name ?? "",
    walletId: values.walletId || undefined,
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

// Click-to-open edit dialog (full form + a confirm-delete step) — mirrors
// category-list.tsx's CategoryEditDialog and tag-list.tsx's TagEditDialog.
// Replaces the previous inline-edit-in-row state and hover-reveal edit/
// delete icons, which never showed on touch devices (no hover state) —
// every other settings list in this app already uses "tap the row to edit".
function RuleEditDialog({
  rule,
  categories,
  walletOptions,
  open,
  onClose,
}: {
  rule: CounterpartyRuleRowData;
  categories: CategoryOption[];
  walletOptions: WalletOption[];
  open: boolean;
  onClose: () => void;
}) {
  const [values, setValues] = useState<RuleFormValues>(() => defaultFormValues(rule));
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Reset whenever the dialog (re)opens.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setValues(defaultFormValues(rule));
      setConfirmingDelete(false);
    }
  }

  function handlePatch(patch: Partial<RuleFormValues>) {
    setValues((v) => ({ ...v, ...patch }));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateCounterpartyRule(rule.id, buildPayload(values, walletOptions));
      onClose();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteCounterpartyRule(rule.id);
      onClose();
    });
  }

  // A rule whose walletId hasn't been backfilled yet has "" here — mirror
  // transaction-row.tsx's EditWalletSelect saveDisabled guard rather than
  // letting an empty walletId reach updateCounterpartyRule (buildPayload
  // would resolve an empty `wallet` name for it).
  const saveDisabled = pending || values.walletId === "";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{confirmingDelete ? "Delete rule?" : "Edit rule"}</DialogTitle>
        </DialogHeader>
        {confirmingDelete ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">
              Delete this rule for &quot;{rule.matchValue}&quot;? Future matching transactions will no
              longer be routed automatically.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmingDelete(false)} autoFocus>
                Cancel
              </Button>
              <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
                Confirm delete
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <RuleFormFields
              values={values}
              categories={categories}
              walletOptions={walletOptions}
              onChange={handlePatch}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                disabled={pending}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveDisabled}>
                Save rule
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FlagBadge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

// Six data columns: Type | Match (+ direction) | Category | Wallet | Flags |
// Activity. Narrower than that on mobile, columns would either overflow the
// card or squeeze into each other — the RuleList wrapper scrolls
// horizontally instead, mirroring category-list.tsx's ROW_GRID treatment.
const ROW_GRID = "grid grid-cols-[6.5rem_1fr_8rem_8rem_9rem_8rem] items-center gap-3 px-4 py-3";

function RuleRow({
  rule,
  categories,
  walletOptions,
}: {
  rule: CounterpartyRuleRowData;
  categories: CategoryOption[];
  walletOptions: WalletOption[];
}) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Edit rule"
        onClick={() => setEditOpen(true)}
        className={cn(
          ROW_GRID,
          "w-full text-left border-b border-border last:border-0 transition-colors hover:bg-muted/20"
        )}
      >
        <span className="inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {MATCH_TYPE_LABELS[rule.matchType]}
        </span>

        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{rule.matchValue}</div>
          <div className="text-xs text-muted-foreground">{DIRECTION_LABELS[rule.direction]}</div>
        </div>

        <span className="truncate text-sm">{rule.appCategoryName}</span>

        <span className="truncate text-sm text-muted-foreground">· {rule.wallet}</span>

        <div className="flex flex-wrap gap-1">
          {rule.autoRecord && (
            <FlagBadge className="bg-blue-500/10 text-blue-600 dark:text-blue-400">Auto-record</FlagBadge>
          )}
          {rule.recurring && (
            <FlagBadge className="bg-violet-500/10 text-violet-600 dark:text-violet-400">Recurring</FlagBadge>
          )}
        </div>

        <div className="text-right text-xs text-muted-foreground">
          <div>
            {rule.matchCount} match{rule.matchCount !== 1 ? "es" : ""}
          </div>
          <div>{formatLastMatched(rule.lastMatchedAt)}</div>
        </div>
      </button>
      <RuleEditDialog
        rule={rule}
        categories={categories}
        walletOptions={walletOptions}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
  );
}

function AddRuleRow({
  categories,
  walletOptions,
  onDone,
}: {
  categories: CategoryOption[];
  walletOptions: WalletOption[];
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
      await createCounterpartyRule(buildPayload(values, walletOptions));
      onDone();
    });
  }

  const submitDisabled = pending || values.walletId === "";

  return (
    <form onSubmit={handleSubmit} className="flex items-start justify-between gap-3 p-4 border-t border-border">
      <RuleFormFields values={values} categories={categories} walletOptions={walletOptions} onChange={handlePatch} />
      <div className="flex gap-1 shrink-0 pt-1">
        <Button type="submit" size="icon" className="size-8" disabled={submitDisabled} aria-label="Create rule">
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
  walletOptions,
}: {
  rules: CounterpartyRuleRowData[];
  categories: CategoryOption[];
  walletOptions: WalletOption[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-3xl">
          {rules.length > 0 && (
            <div
              className={cn(
                ROW_GRID,
                "border-b border-border/60 bg-muted/20 py-2 text-xs text-muted-foreground uppercase tracking-wide"
              )}
            >
              <span>Type</span>
              <span>Match</span>
              <span>Category</span>
              <span>Wallet</span>
              <span>Flags</span>
              <span className="text-right">Activity</span>
            </div>
          )}

          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} categories={categories} walletOptions={walletOptions} />
          ))}

          {rules.length === 0 && !adding && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No rules yet. Add one below.
            </div>
          )}

          {adding && <AddRuleRow categories={categories} walletOptions={walletOptions} onDone={() => setAdding(false)} />}
        </div>
      </div>

      {!adding && (
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
