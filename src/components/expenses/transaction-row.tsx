"use client";

import { useId, useState, useTransition } from "react";
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
import { formatCOP, dateInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import { resolveEffectiveCategoryStyle } from "@/lib/category-style";
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

// Contextual accessible name for the tap-to-edit row button — must
// disambiguate a row from its siblings for screen reader users tabbing
// through the list (a static "Edit transaction" label on every row is
// no longer enough once the whole row is the interactive element). The
// date is included unconditionally (not just when the date column is
// visually shown) since it's genuinely part of a transaction's identity
// regardless of which column layout is currently visible — two rows with
// the same note/amount on different days must still get distinct labels.
// Note text is truncated independently of the visual `truncate` class,
// since a very long note would otherwise make the announced label unwieldy.
function rowAriaLabel(item: LedgerItem): string {
  const identity = item.note?.trim() || item.categoryName || "Uncategorized";
  const truncatedIdentity = identity.length > 40 ? `${identity.slice(0, 40)}…` : identity;
  const sign = item.amount < 0 ? "-" : "+";
  return `Edit transaction — ${formatRowDate(item.date)}, ${truncatedIdentity}, ${sign}${formatCOP(Math.abs(item.amount))}`;
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

  // The Dialog's content depends on `mode`, but `mode` returns to "default"
  // the instant we ask it to close (Escape/backdrop/Cancel) — if the popup
  // content were gated directly on `mode`, it would flash empty during the
  // close animation. `displayMode` tracks the last non-default mode instead,
  // so the dialog keeps showing its last view while it animates out. This is
  // the same render-time re-sync pattern `installment-form.tsx` uses for
  // `lastEditing`.
  const [displayMode, setDisplayMode] = useState<Exclude<Mode, "default">>("edit");
  if (mode !== "default" && mode !== displayMode) {
    setDisplayMode(mode);
  }

  function cancelToDefault() {
    setValues(formValuesFromItem(item, categories));
    setMode("default");
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

  return (
    <>
      <TransactionDefaultRow
        item={item}
        groupBy={groupBy}
        onEdit={() => {
          setValues(formValuesFromItem(item, categories));
          setMode("edit");
        }}
      />
      <Dialog open={mode !== "default"} onOpenChange={(open) => !open && cancelToDefault()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {displayMode === "edit" ? "Edit transaction" : "Delete transaction?"}
            </DialogTitle>
          </DialogHeader>
          {displayMode === "edit" ? (
            <TransactionEditForm
              values={values}
              categories={categories}
              pending={pending}
              onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
              onSubmit={handleSave}
              onCancel={cancelToDefault}
              onDeleteRequest={() => setMode("delete-confirm")}
            />
          ) : (
            <TransactionDeleteConfirm
              pending={pending}
              onConfirm={handleDelete}
              onCancel={cancelToDefault}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TransactionDefaultRow({
  item,
  groupBy,
  onEdit,
}: {
  item: LedgerItem;
  groupBy: LedgerGroupBy;
  onEdit: () => void;
}) {
  const { icon: CategoryIcon, badge, iconWrap } = resolveEffectiveCategoryStyle(
    item.categoryName,
    item.categoryIcon,
    item.categoryColor
  );

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={rowAriaLabel(item)}
      className={cn(
        "flex w-full flex-col gap-2 px-4 py-2.5 border-b border-border/40 last:border-0",
        "sm:flex-row sm:items-center sm:gap-3 sm:py-2",
        "text-left cursor-pointer transition-colors",
        "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        "active:bg-muted/70",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 sm:flex-1">
        {groupBy !== "day" && (
          <span className="text-xs tabular-nums text-muted-foreground w-11 shrink-0">
            {formatRowDate(item.date)}
          </span>
        )}
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", iconWrap)}>
          <CategoryIcon className="size-4" />
        </span>
        {groupBy !== "category" && item.categoryName && (
          <span
            className={cn(
              "inline-flex w-fit shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
              badge
            )}
          >
            {item.categoryName}
          </span>
        )}
        <span className="text-sm truncate flex-1 min-w-0">{item.note || "—"}</span>
      </div>

      {/* Meta + amount: own line on mobile (avoids the amount colliding
          with the wallet label), inline on sm+ via `contents` so desktop
          keeps the original single-row layout. */}
      <div className="flex items-center justify-between gap-2 sm:contents">
        <div className="flex items-center gap-2 min-w-0 sm:contents">
          {groupBy !== "wallet" && (
            <span className="text-xs text-muted-foreground shrink-0">· {item.walletName ?? item.wallet}</span>
          )}
          {item.source === "MANUAL" && (
            <span className="text-xs text-muted-foreground shrink-0">manual</span>
          )}
        </div>
        <span
          className={cn(
            "font-mono text-sm tabular-nums shrink-0 text-right sm:min-w-24",
            item.amount < 0 ? "text-destructive" : "text-success"
          )}
        >
          {item.amount < 0 ? "-" : "+"}
          {formatCOP(Math.abs(item.amount))}
        </span>
      </div>
    </button>
  );
}

function TransactionEditForm({
  values,
  categories,
  pending,
  onChange,
  onSubmit,
  onCancel,
  onDeleteRequest,
}: {
  values: RowFormValues;
  categories: CategoryOption[];
  pending: boolean;
  onChange: (patch: Partial<RowFormValues>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onDeleteRequest: () => void;
}) {
  const idPrefix = useId();
  const selectedCategoryName =
    categories.find((c) => c.id === values.appCategoryId)?.name ?? "Sin categoría";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-amount`}>Amount</Label>
          <Input
            id={`${idPrefix}-amount`}
            type="number"
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
          <Select
            value={values.appCategoryId}
            onValueChange={(v) => v && onChange({ appCategoryId: v })}
          >
            <SelectTrigger className="w-full" aria-label="Category">
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
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-wallet`}>Wallet</Label>
          <Input
            id={`${idPrefix}-wallet`}
            value={values.wallet}
            onChange={(e) => onChange({ wallet: e.target.value })}
            placeholder="Wallet"
            required
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
        <Button
          type="button"
          variant="destructive"
          className="sm:mr-auto"
          disabled={pending}
          onClick={onDeleteRequest}
        >
          Delete
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}

function TransactionDeleteConfirm({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-destructive">Delete this transaction?</p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} autoFocus>
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={onConfirm}
        >
          Confirm delete
        </Button>
      </DialogFooter>
    </div>
  );
}
