"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { formatCOP, dateInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { updateTransaction, deleteTransaction } from "@/lib/actions/transactions";
import type { LedgerItem, LedgerGroupBy } from "@/lib/queries/transactions";
import type { CategoryOption } from "@/lib/queries/expenses";

const NONE_CATEGORY = "__none__";

type Mode = "default" | "edit" | "delete-confirm";

type RowFormValues = {
  amount: string;
  date: string;
  appCategoryId: string;
  wallet: string;
  note: string;
};

function formatRowDate(date: Date): string {
  return new Date(date).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function formValuesFromItem(item: LedgerItem, categories: CategoryOption[]): RowFormValues {
  return {
    amount: String(item.amount),
    date: dateInputValue(item.date),
    appCategoryId: categories.find((c) => c.name === item.categoryName)?.id ?? NONE_CATEGORY,
    wallet: item.wallet,
    note: item.note ?? "",
  };
}

type Props = {
  item: LedgerItem;
  groupBy: LedgerGroupBy;
  categories: CategoryOption[];
};

export function TransactionRow({ item, groupBy, categories }: Props) {
  const [mode, setMode] = useState<Mode>("default");
  const [values, setValues] = useState<RowFormValues>(() => formValuesFromItem(item, categories));
  const [pending, startTransition] = useTransition();

  function cancelToDefault() {
    setValues(formValuesFromItem(item, categories));
    setMode("default");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") cancelToDefault();
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateTransaction(item.id, {
        amount: parseFloat(values.amount),
        date: new Date(values.date + "T12:00:00"),
        appCategoryId: values.appCategoryId === NONE_CATEGORY ? null : values.appCategoryId,
        wallet: values.wallet,
        note: values.note.trim() === "" ? null : values.note,
      });
      setMode("default");
    });
  }

  function handleDelete() {
    startTransition(() => deleteTransaction(item.id));
  }

  if (mode === "edit") {
    return (
      <TransactionEditForm
        values={values}
        categories={categories}
        pending={pending}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        onSubmit={handleSave}
        onCancel={cancelToDefault}
        onKeyDown={handleKeyDown}
      />
    );
  }

  if (mode === "delete-confirm") {
    return (
      <TransactionDeleteConfirm
        pending={pending}
        onConfirm={handleDelete}
        onCancel={cancelToDefault}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <TransactionDefaultRow
      item={item}
      groupBy={groupBy}
      onEdit={() => {
        setValues(formValuesFromItem(item, categories));
        setMode("edit");
      }}
      onDeleteRequest={() => setMode("delete-confirm")}
    />
  );
}

function TransactionDefaultRow({
  item,
  groupBy,
  onEdit,
  onDeleteRequest,
}: {
  item: LedgerItem;
  groupBy: LedgerGroupBy;
  onEdit: () => void;
  onDeleteRequest: () => void;
}) {
  return (
    <div className="group/txnrow flex items-center gap-3 px-4 py-2 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {groupBy !== "day" && (
          <span className="text-xs tabular-nums text-muted-foreground w-11 shrink-0">
            {formatRowDate(item.date)}
          </span>
        )}
        <span className="text-sm truncate flex-1 min-w-0">{item.note || "—"}</span>
        {groupBy !== "category" && item.categoryName && (
          <span className="inline-flex w-fit shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {item.categoryName}
          </span>
        )}
        {groupBy !== "wallet" && (
          <span className="text-xs text-muted-foreground shrink-0">· {item.walletName ?? item.wallet}</span>
        )}
        {item.source === "MANUAL" && (
          <span className="text-xs text-muted-foreground shrink-0">manual</span>
        )}
      </div>
      <span
        className={cn(
          "font-mono text-sm tabular-nums shrink-0 min-w-24 text-right",
          item.amount < 0 ? "text-destructive" : "text-success"
        )}
      >
        {item.amount < 0 ? "-" : "+"}
        {formatCOP(Math.abs(item.amount))}
      </span>
      <div className="flex gap-1 opacity-0 group-hover/txnrow:opacity-100 transition-opacity shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Edit transaction"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-destructive hover:text-destructive"
          aria-label="Delete transaction"
          onClick={onDeleteRequest}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function TransactionEditForm({
  values,
  categories,
  pending,
  onChange,
  onSubmit,
  onCancel,
  onKeyDown,
}: {
  values: RowFormValues;
  categories: CategoryOption[];
  pending: boolean;
  onChange: (patch: Partial<RowFormValues>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const selectedCategoryName =
    categories.find((c) => c.id === values.appCategoryId)?.name ?? "Sin categoría";

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      className="flex items-start justify-between gap-3 px-4 py-2 border-b border-border/40 last:border-0"
    >
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        <Input
          type="number"
          value={values.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
          className="h-8 w-28 font-mono text-sm"
          aria-label="Amount"
          autoFocus
          required
        />
        <Input
          type="date"
          value={values.date}
          onChange={(e) => onChange({ date: e.target.value })}
          className="h-8 w-36 text-sm"
          aria-label="Date"
          required
        />
        <Select
          value={values.appCategoryId}
          onValueChange={(v) => v && onChange({ appCategoryId: v })}
        >
          <SelectTrigger className="h-8 w-36" aria-label="Category">
            <span className="text-sm truncate">{selectedCategoryName}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_CATEGORY}>Sin categoría</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={values.wallet}
          onChange={(e) => onChange({ wallet: e.target.value })}
          className="h-8 w-28 text-sm"
          placeholder="Wallet"
          aria-label="Wallet"
          required
        />
        <Input
          value={values.note}
          onChange={(e) => onChange({ note: e.target.value })}
          className="h-8 flex-1 min-w-32 text-sm"
          placeholder="Note"
          aria-label="Note"
        />
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          type="submit"
          size="icon"
          className="size-7"
          disabled={pending}
          aria-label="Save changes"
        >
          <Check className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Cancel edit"
          onClick={onCancel}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </form>
  );
}

function TransactionDeleteConfirm({
  pending,
  onConfirm,
  onCancel,
  onKeyDown,
}: {
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div
      onKeyDown={onKeyDown}
      className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border/40 last:border-0"
    >
      <span className="text-sm text-destructive">Delete this transaction?</span>
      <div className="flex gap-1 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-destructive hover:text-destructive"
          aria-label="Confirm delete"
          disabled={pending}
          onClick={onConfirm}
        >
          <Check className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Cancel delete"
          onClick={onCancel}
          autoFocus
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
