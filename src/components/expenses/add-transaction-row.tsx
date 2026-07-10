"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { dateInputValue } from "@/lib/format";
import { createTransaction } from "@/lib/actions/transactions";
import type { CategoryOption } from "@/lib/queries/expenses";

type TxnType = "expense" | "income";

type FormValues = {
  type: TxnType;
  amount: string;
  date: string;
  appCategoryId: string;
  walletId: string;
  note: string;
};

// Open-time / post-cancel defaults. `walletId` is the one field that carries
// state across expand/collapse cycles within the session (see
// AddTransactionRow's `lastWallet`) — every other field resets clean.
function defaultValues(lastWallet: string): FormValues {
  return {
    type: "expense",
    amount: "",
    date: dateInputValue(new Date()),
    appCategoryId: "",
    walletId: lastWallet,
    note: "",
  };
}

// Pure so it's easy to reason about / test independent of the component —
// candidate for extraction into a unit test if this logic grows.
function canSubmit(values: FormValues): boolean {
  const amount = parseFloat(values.amount);
  return (
    !Number.isNaN(amount) &&
    amount !== 0 &&
    values.appCategoryId !== "" &&
    values.walletId !== "" &&
    values.date !== "" &&
    !Number.isNaN(new Date(values.date + "T12:00:00").getTime())
  );
}

// Amount is always typed as a positive magnitude; the sign is applied here
// from the TypeToggle selection at submit time.
function signedAmount(type: TxnType, rawAmount: string): number {
  const magnitude = Math.abs(parseFloat(rawAmount));
  return type === "expense" ? -magnitude : magnitude;
}

type Props = {
  categories: CategoryOption[];
  walletOptions: { id: string; name: string }[];
};

// Rendered as a SIBLING of LedgerControls (not a child) so it stays
// interactive during LedgerControls's filter-requery dimming — see
// .scratch/manual-transaction-entry.md's placement decision. Collapsed by
// default; expands in place into an inline creation row mirroring
// TransactionEditForm's shape (transaction-row.tsx).
export function AddTransactionRow({ categories, walletOptions }: Props) {
  const [mode, setMode] = useState<"collapsed" | "expanded">("collapsed");
  const [lastWallet, setLastWallet] = useState("");
  const [values, setValues] = useState<FormValues>(() => defaultValues(""));
  const [pending, startTransition] = useTransition();
  const amountInputRef = useRef<HTMLInputElement>(null);

  function expand() {
    setValues(defaultValues(lastWallet));
    setMode("expanded");
  }

  function collapseToDefaults() {
    setValues(defaultValues(lastWallet));
    setMode("collapsed");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") collapseToDefaults();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit(values)) return;
    const submittedWalletId = values.walletId;
    const submittedWalletName = walletOptions.find((w) => w.id === submittedWalletId)?.name ?? "";
    startTransition(async () => {
      try {
        await createTransaction({
          amount: signedAmount(values.type, values.amount),
          date: new Date(values.date + "T12:00:00"),
          appCategoryId: values.appCategoryId,
          wallet: submittedWalletName,
          walletId: submittedWalletId,
          note: values.note.trim() === "" ? undefined : values.note,
        });
        toast.success("Transaction added");
        setLastWallet(submittedWalletId);
        // Speed optimization for batch entry: only clear amount/note, keep
        // type/date/appCategoryId/walletId as-is and stay expanded.
        setValues((v) => ({ ...v, amount: "", note: "" }));
        amountInputRef.current?.focus();
      } catch {
        toast.error("Couldn't add transaction");
      }
    });
  }

  if (mode === "collapsed") {
    return <CollapsedTrigger onExpand={expand} />;
  }

  return (
    <ExpandedCreateForm
      values={values}
      categories={categories}
      walletOptions={walletOptions}
      pending={pending}
      amountInputRef={amountInputRef}
      onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
      onSubmit={handleSubmit}
      onCancel={collapseToDefaults}
      onKeyDown={handleKeyDown}
    />
  );
}

function CollapsedTrigger({ onExpand }: { onExpand: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-expanded={false}
      onClick={onExpand}
      className="h-auto w-full justify-start gap-1.5 rounded-xl border border-dashed border-border/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <Plus className="size-3.5" />
      Add transaction
    </Button>
  );
}

function ExpandedCreateForm({
  values,
  categories,
  walletOptions,
  pending,
  amountInputRef,
  onChange,
  onSubmit,
  onCancel,
  onKeyDown,
}: {
  values: FormValues;
  categories: CategoryOption[];
  walletOptions: { id: string; name: string }[];
  pending: boolean;
  amountInputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (patch: Partial<FormValues>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const submitDisabled = pending || !canSubmit(values);

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      className="flex items-start justify-between gap-3 rounded-xl border border-border/60 px-4 py-2"
    >
      <div className="flex flex-1 min-w-0 flex-wrap items-center gap-2">
        <TypeToggle value={values.type} onChange={(type) => onChange({ type })} />
        <Input
          ref={amountInputRef}
          type="number"
          min="0"
          value={values.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
          className="h-8 w-28 font-mono text-sm"
          aria-label="Amount"
          autoFocus
        />
        <Input
          type="date"
          value={values.date}
          onChange={(e) => onChange({ date: e.target.value })}
          className="h-8 w-36 text-sm"
          aria-label="Date"
        />
        <CreateCategorySelect
          value={values.appCategoryId}
          categories={categories}
          onChange={(v) => onChange({ appCategoryId: v })}
        />
        <CreateWalletSelect
          value={values.walletId}
          options={walletOptions}
          onChange={(v) => onChange({ walletId: v })}
        />
        <Input
          value={values.note}
          onChange={(e) => onChange({ note: e.target.value })}
          className="h-8 min-w-32 flex-1 text-sm"
          placeholder="Note"
          aria-label="Note"
        />
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          type="submit"
          size="icon"
          className="size-7"
          disabled={submitDisabled}
          aria-label="Add transaction"
        >
          <Check className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Cancel"
          onClick={onCancel}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </form>
  );
}

function TypeToggle({ value, onChange }: { value: TxnType; onChange: (v: TxnType) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={value === "expense"}
        aria-label="Mark as expense"
        onClick={() => onChange("expense")}
        className={cn(
          value === "expense" && "bg-muted text-destructive hover:bg-muted hover:text-destructive"
        )}
      >
        Expense
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={value === "income"}
        aria-label="Mark as income"
        onClick={() => onChange("income")}
        className={cn(value === "income" && "bg-muted text-success hover:bg-muted hover:text-success")}
      >
        Income
      </Button>
    </div>
  );
}

function CreateCategorySelect({
  value,
  categories,
  onChange,
}: {
  value: string;
  categories: CategoryOption[];
  onChange: (v: string) => void;
}) {
  const selectedName = categories.find((c) => c.id === value)?.name ?? "Category";
  return (
    <Select value={value || undefined} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="h-8 w-36" aria-label="Category">
        <span className="text-sm truncate">{selectedName}</span>
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

// Binds value={w.id}, matching ledger-controls.tsx's filter WalletSelect —
// the id is passed straight through as createTransaction's walletId, which
// bypasses resolveWalletId's ambiguous name-based lookup entirely.
function CreateWalletSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; name: string }[];
  onChange: (v: string) => void;
}) {
  const selectedName = options.find((w) => w.id === value)?.name ?? "Wallet";
  return (
    <Select value={value || undefined} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="h-8 w-32" aria-label="Wallet">
        <span className="text-sm truncate">{selectedName}</span>
      </SelectTrigger>
      <SelectContent>
        {options.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
