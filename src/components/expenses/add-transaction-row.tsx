"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
// state across open/close cycles within the session (see AddTransactionRow's
// `lastWallet`) — every other field resets clean.
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

// Renders a trigger button that opens a modal creation form — kept out of
// LedgerControls' filter-requery dimming since it's a Dialog now (always
// interactive regardless of what's happening in the list behind it). Modal
// instead of the old inline-expanding row: expanding in place pushed the
// list down and stole scroll position, and its autoFocus fired every time
// the row expanded even when it wasn't the user's intent to type immediately.
export function AddTransactionRow({ categories, walletOptions }: Props) {
  const [open, setOpen] = useState(false);
  const [lastWallet, setLastWallet] = useState("");
  const [values, setValues] = useState<FormValues>(() => defaultValues(""));
  const [pending, startTransition] = useTransition();
  const amountInputRef = useRef<HTMLInputElement>(null);

  function openDialog() {
    setValues(defaultValues(lastWallet));
    setOpen(true);
  }

  function closeDialog() {
    setValues(defaultValues(lastWallet));
    setOpen(false);
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
        // type/date/appCategoryId/walletId as-is and stay open.
        setValues((v) => ({ ...v, amount: "", note: "" }));
        amountInputRef.current?.focus();
      } catch {
        toast.error("Couldn't add transaction");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={openDialog}
        className="h-auto w-full justify-start gap-1.5 rounded-xl border border-dashed border-border/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-4" />
        Add transaction
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add transaction</DialogTitle>
          </DialogHeader>
          <CreateForm
            values={values}
            categories={categories}
            walletOptions={walletOptions}
            pending={pending}
            amountInputRef={amountInputRef}
            onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
            onSubmit={handleSubmit}
            onCancel={closeDialog}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateForm({
  values,
  categories,
  walletOptions,
  pending,
  amountInputRef,
  onChange,
  onSubmit,
  onCancel,
}: {
  values: FormValues;
  categories: CategoryOption[];
  walletOptions: { id: string; name: string }[];
  pending: boolean;
  amountInputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (patch: Partial<FormValues>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const idPrefix = useId();
  const submitDisabled = pending || !canSubmit(values);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TypeToggle value={values.type} onChange={(type) => onChange({ type })} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-amount`}>Amount</Label>
          <Input
            ref={amountInputRef}
            id={`${idPrefix}-amount`}
            type="number"
            min="0"
            value={values.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            className="font-mono"
            autoFocus
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-date`}>Date</Label>
          <Input
            id={`${idPrefix}-date`}
            type="date"
            value={values.date}
            onChange={(e) => onChange({ date: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <CreateCategorySelect
            value={values.appCategoryId}
            categories={categories}
            onChange={(v) => onChange({ appCategoryId: v })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Wallet</Label>
          <CreateWalletSelect
            value={values.walletId}
            options={walletOptions}
            onChange={(v) => onChange({ walletId: v })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-note`}>
          Note <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id={`${idPrefix}-note`}
          value={values.note}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="Note"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitDisabled}>
          <Check className="size-4" />
          Add transaction
        </Button>
      </DialogFooter>
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
      <SelectTrigger className="w-full" aria-label="Category">
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
      <SelectTrigger className="w-full" aria-label="Wallet">
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
