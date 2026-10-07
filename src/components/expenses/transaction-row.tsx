"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ColorDot,
  DateField,
  Field,
  FormDialog,
  FormFooter,
  MoneyInput,
  OptionSelect,
  SegmentedControl,
  TagInput,
  type SegmentOption,
} from "@/components/ds";
import { formatCOP, dateInputValue } from "@/lib/format";
import { amountToDigits } from "@/lib/form-format";
import { cn } from "@/lib/utils";
import { resolveEffectiveCategoryStyle } from "@/lib/category-style";
import { updateTransaction, deleteTransaction, setTransactionTags } from "@/lib/actions/transactions";
import { categorySelectOptions } from "@/components/shared/category-option";
import { parseTagNames } from "@/lib/tag-utils";
import type { LedgerItem, LedgerGroupBy } from "@/lib/queries/transactions";
import type { CategoryOption } from "@/lib/queries/expenses";
import type { TagOption } from "@/lib/queries/tags";

type Mode = "default" | "edit" | "delete-confirm";

type RowFormValues = {
  /** Sign of the amount; a transfer leg keeps the one it has. */
  kind: "expense" | "income";
  /** Magnitude as digits (MoneyInput). */
  amount: string;
  date: string;
  appCategoryId: string | null;
  walletId: string;
  note: string;
  // Comma-separated tag names as typed — parsed into a list at save time
  // (parseTagNames), not kept structured here since a free-text input is the
  // simplest way to add/remove several tags at once without a picker widget.
  tagNames: string;
};

// Built from Intl parts (not toLocaleDateString directly) to drop the " de "
// connector es-CO inserts between day and month ("11 de sept") — that made
// the date overflow to a second line in the row's fixed-width mobile column.
function formatRowDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).formatToParts(
    new Date(date)
  );
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${day} ${month}`;
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
    kind: item.amount < 0 ? "expense" : "income",
    amount: amountToDigits(item.amount),
    date: dateInputValue(item.date),
    appCategoryId: categories.find((c) => c.name === item.categoryName)?.id ?? null,
    walletId: item.walletId ?? "",
    note: item.note ?? "",
    tagNames: item.tags.map((t) => t.name).join(", "),
  };
}

type Props = {
  item: LedgerItem;
  groupBy: LedgerGroupBy;
  /** Show the row's wallet after its category (the ledger is on All wallets). */
  showWallet?: boolean;
  categories: CategoryOption[];
  walletOptions: { id: string; name: string }[];
  tags: TagOption[];
};

export function TransactionRow({ item, groupBy, showWallet = false, categories, walletOptions, tags }: Props) {
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
      await Promise.all([
        updateTransaction(item.id, {
          amount: values.kind === "expense" ? -Math.abs(parseFloat(values.amount)) : Math.abs(parseFloat(values.amount)),
          date: new Date(values.date + "T12:00:00"),
          appCategoryId: values.appCategoryId,
          walletId: values.walletId,
          note: values.note.trim() === "" ? null : values.note,
        }),
        setTransactionTags(item.id, parseTagNames(values.tagNames)),
      ]);
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
        showWallet={showWallet}
        onEdit={() => {
          setValues(formValuesFromItem(item, categories));
          setMode("edit");
        }}
      />
      <TransactionDialog
        open={mode !== "default"}
        view={displayMode}
        item={item}
        values={values}
        categories={categories}
        walletOptions={walletOptions}
        tags={tags}
        pending={pending}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        onSubmit={handleSave}
        onCancel={cancelToDefault}
        onDeleteRequest={() => setMode("delete-confirm")}
        onDelete={handleDelete}
      />
    </>
  );
}

function TransactionDefaultRow({
  item,
  groupBy,
  showWallet,
  onEdit,
}: {
  item: LedgerItem;
  groupBy: LedgerGroupBy;
  showWallet: boolean;
  onEdit: () => void;
}) {
  const { icon: CategoryIcon, badge, iconWrap } = resolveEffectiveCategoryStyle(
    item.categoryName,
    item.categoryIcon,
    item.categoryColor
  );
  // Grouped by category, every row in the group shares the heading's
  // category, so the chip would just repeat it.
  const showCategory = groupBy !== "category";
  const walletName = showWallet ? item.walletName : null;

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={rowAriaLabel(item)}
      className={cn(
        "flex w-full items-center px-4 py-2.5 border-b border-border/40 last:border-0",
        "text-left cursor-pointer transition-colors",
        "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
        "active:bg-muted/70",
        "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      )}
    >
      {/* [icon] note / (category chip · tags) … amount. One layout for every
          width: the note leads (it's what identifies the transaction) and the
          category + tags sit under it, so nothing has to move to a second
          line on mobile. Expenses read in the foreground colour and only
          income is tinted — a ledger of red rows made everything look like a
          warning. */}
      <div className="flex w-full min-w-0 items-center gap-3">
        {groupBy !== "day" && (
          <span className="text-xs tabular-nums text-muted-foreground w-14 shrink-0 whitespace-nowrap">
            {formatRowDate(item.date)}
          </span>
        )}
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", iconWrap)}>
          <CategoryIcon className="size-4.5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-medium">{item.note || "—"}</span>
          <RowMeta item={item} category={showCategory ? item.categoryName : null} badge={badge} walletName={walletName} />
        </span>
        <span
          className={cn(
            "ml-auto font-mono text-sm tabular-nums shrink-0 sm:min-w-24 sm:text-right",
            item.amount < 0 ? "text-foreground" : "text-success"
          )}
        >
          {item.amount < 0 ? "-" : "+"}
          {formatCOP(Math.abs(item.amount))}
        </span>
      </div>
    </button>
  );
}

// Second line of a row: category chip · wallet (under All wallets) · tags.
function RowMeta({
  item,
  category,
  badge,
  walletName,
}: {
  item: LedgerItem;
  category: string | null;
  badge: string;
  walletName: string | null;
}) {
  if (!category && !walletName && item.tags.length === 0) return null;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {category && (
        <span
          className={cn(
            "inline-flex w-fit shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
            badge
          )}
        >
          {category}
        </span>
      )}
      {walletName && (
        <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <ColorDot color={item.walletColor} />
          <span className="truncate">{walletName}</span>
        </span>
      )}
      {item.tags.map((t) => (
        <span key={t.id} className="shrink-0 text-xs text-muted-foreground">
          #{t.name}
        </span>
      ))}
    </span>
  );
}

type EditKind = "expense" | "income";

const KIND_OPTIONS: SegmentOption<EditKind>[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
];

/** Edit + delete-confirm for one ledger row, in the shared FormDialog. */
function TransactionDialog({
  open,
  view,
  item,
  values,
  categories,
  walletOptions,
  tags,
  pending,
  onChange,
  onSubmit,
  onCancel,
  onDeleteRequest,
  onDelete,
}: {
  open: boolean;
  view: Exclude<Mode, "default">;
  item: LedgerItem;
  values: RowFormValues;
  categories: CategoryOption[];
  walletOptions: { id: string; name: string }[];
  tags: TagOption[];
  pending: boolean;
  onChange: (patch: Partial<RowFormValues>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  onDeleteRequest: () => void;
  onDelete: () => void;
}) {
  if (view === "delete-confirm") {
    return (
      <FormDialog
        open={open}
        onOpenChange={(o) => !o && onCancel()}
        title={item.isTransfer ? "Delete transfer?" : "Delete transaction?"}
        footer={
          <FormFooter>
            <Button type="button" variant="outline" onClick={onCancel} autoFocus>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={onDelete}>
              Delete
            </Button>
          </FormFooter>
        }
      >
        <p className="text-sm text-muted-foreground">
          {item.isTransfer
            ? "Both the outgoing and the incoming leg will be removed."
            : `${item.note?.trim() || item.categoryName || "This transaction"} · ${formatCOP(Math.abs(item.amount))} will be removed.`}
        </p>
      </FormDialog>
    );
  }
  // A legacy row whose walletId hasn't been backfilled yet has "" here —
  // don't let an empty walletId reach updateTransaction (it would clear it).
  const missing = editMissingHint(values);
  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onCancel()}
      title={item.isTransfer ? "Edit transfer leg" : "Edit transaction"}
      onSubmit={onSubmit}
      footer={
        <FormFooter hint={pending ? "" : missing}>
          <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto" disabled={pending} onClick={onDeleteRequest}>
            Delete
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !!missing}>
            Save changes
          </Button>
        </FormFooter>
      }
    >
      <EditFields item={item} values={values} categories={categories} walletOptions={walletOptions} tags={tags} onChange={onChange} />
    </FormDialog>
  );
}

/** Footer hint naming what's missing before an edit can be saved ("" when ready). */
export function editMissingHint(values: RowFormValues): string {
  const amount = parseFloat(values.amount);
  if (Number.isNaN(amount) || amount === 0) return "Add an amount to save.";
  if (!values.walletId) return "Pick a wallet to save.";
  return "";
}

function EditFields({
  item,
  values,
  categories,
  walletOptions,
  tags,
  onChange,
}: {
  item: LedgerItem;
  values: RowFormValues;
  categories: CategoryOption[];
  walletOptions: { id: string; name: string }[];
  tags: TagOption[];
  onChange: (patch: Partial<RowFormValues>) => void;
}) {
  const idPrefix = useId();
  return (
    <>
      {/* A transfer leg's sign is fixed by which side of the transfer it is. */}
      {!item.isTransfer && (
        <SegmentedControl ariaLabel="Transaction type" value={values.kind} onChange={(kind) => onChange({ kind })} options={KIND_OPTIONS} />
      )}
      <Field label="Amount" htmlFor={`${idPrefix}-amount`}>
        <MoneyInput id={`${idPrefix}-amount`} size="lg" value={values.amount} onValueChange={(amount) => onChange({ amount })} autoFocus required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <OptionSelect
            ariaLabel="Category"
            value={values.appCategoryId}
            onChange={(v) => onChange({ appCategoryId: v })}
            noneLabel="No category"
            // Includes the transfer categories: a transfer leg must keep its own.
            options={categorySelectOptions(categories)}
          />
        </Field>
        <Field label="Wallet">
          <OptionSelect
            ariaLabel="Wallet"
            value={values.walletId || null}
            onChange={(v) => onChange({ walletId: v ?? "" })}
            options={walletOptions.map((w) => ({ value: w.id, label: w.name }))}
          />
        </Field>
      </div>
      <Field label="Date" htmlFor={`${idPrefix}-date`}>
        <DateField id={`${idPrefix}-date`} value={values.date} onChange={(date) => onChange({ date })} quickPicks={["today", "yesterday"]} required />
      </Field>
      <Field label="Note" htmlFor={`${idPrefix}-note`} optional>
        <Input id={`${idPrefix}-note`} value={values.note} onChange={(e) => onChange({ note: e.target.value })} placeholder="What was it for?" />
      </Field>
      <Field label="Tags" htmlFor={`${idPrefix}-tags`} optional>
        <TagInput id={`${idPrefix}-tags`} value={values.tagNames} existing={tags.map((t) => t.name)} onChange={(tagNames) => onChange({ tagNames })} />
      </Field>
    </>
  );
}
