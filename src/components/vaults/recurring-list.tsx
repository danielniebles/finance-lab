"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money, SectionHeader, StatusChip } from "@/components/ds";
import { TONE_CLASSES, toneForRecurringStatus } from "@/lib/status";
import { cadenceLabel, daysUntil } from "@/lib/vault-display";
import { cn } from "@/lib/utils";
import { RecurringExpenseForm, type RecurringFormContext } from "./recurring-expense-form";
import { RecurringPayDialog } from "./recurring-pay-dialog";
import type { RecurringExpenseRow } from "@/lib/queries/recurring";
import type { VaultWithMetrics } from "@/lib/queries/vaults";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  recurringData: {
    items: RecurringExpenseRow[];
    totalSetAsideThisMonth: number;
    dueThisMonth: RecurringExpenseRow[];
    next90Days: RecurringExpenseRow[];
  };
  recurringVaults: VaultWithMetrics[];
  formContext: RecurringFormContext;
};

// ─── Row ──────────────────────────────────────────────────────────────────────

function statusLabel(item: RecurringExpenseRow): string {
  if (item.status === "DueSoon") {
    const days = daysUntil(new Date(item.nextDueDate));
    if (days === 0) return "Due today";
    if (days > 0) return `Due in ${days} ${days === 1 ? "day" : "days"}`;
    return "Due soon";
  }
  return item.status;
}

/** Calendar-style date tile; tinted when the expense needs attention. */
function DateTile({ item }: { item: RecurringExpenseRow }) {
  const date = new Date(item.nextDueDate);
  const thisYear = date.getFullYear() === new Date().getFullYear();
  const tone = item.status === "DueSoon" || item.status === "Overdue" ? toneForRecurringStatus(item.status) : "neutral";
  return (
    <span
      className={cn(
        "flex w-14 shrink-0 flex-col items-center rounded-lg py-1.5 leading-tight",
        TONE_CLASSES[tone].soft,
        tone === "neutral" && "text-foreground",
      )}
      aria-label={date.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}
    >
      <span className="font-mono text-base font-semibold tabular-nums">{date.getDate()}</span>
      <span className="text-[11px] font-semibold uppercase">
        {date.toLocaleDateString("en-US", { month: "short" })}
        {!thisYear && ` ${String(date.getFullYear()).slice(2)}`}
      </span>
    </span>
  );
}

// One row per recurring expense, soonest first: date tile · name/cadence ·
// status · set-aside · actions. Replaces the 7-column table + separate mobile
// rows; on narrow screens the status and amount wrap under the name.
function RecurringRow({
  item,
  onPay,
  onEdit,
}: {
  item: RecurringExpenseRow;
  onPay: () => void;
  onEdit: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-5">
      <DateTile item={item} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold">{item.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {cadenceLabel(item.cadenceMonths)}
          {item.fundingVaultName ? ` · from ${item.fundingVaultName}` : " · no funding vault"}
        </span>
      </span>
      <span className="flex items-center gap-3 max-sm:w-full max-sm:justify-between max-sm:pl-18">
        <StatusChip tone={toneForRecurringStatus(item.status)}>{statusLabel(item)}</StatusChip>
        <span className="w-28 text-right text-sm">
          <Money value={item.setAsideThisMonth} />
          <span className="text-xs text-muted-foreground">/mo</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 max-sm:ml-auto">
        <Button variant="outline" size="sm" className="h-8 px-3" onClick={onPay} aria-label={`Pay ${item.name}`}>
          Pay
        </Button>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${item.name}`} onClick={onEdit}>
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
      </span>
    </li>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecurringList({ recurringData, recurringVaults, formContext }: Props) {
  const { items } = recurringData;

  // Create / edit form
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpenseRow | undefined>(undefined);

  const [paying, setPaying] = useState<RecurringExpenseRow | null>(null);

  function openCreate() {
    setEditingExpense(undefined);
    setFormOpen(true);
  }

  function openEdit(expense: RecurringExpenseRow) {
    setEditingExpense(expense);
    setFormOpen(true);
  }

  return (
    <section aria-label="Recurring expenses">
      <SectionHeader
        title="Recurring expenses · next due"
        trailing={
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        }
        className="mb-3"
      />

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground">
          <p className="text-sm">No recurring expenses yet — add your first to start tracking upcoming bills.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card">
          {[...items]
            .sort((x, y) => new Date(x.nextDueDate).getTime() - new Date(y.nextDueDate).getTime())
            .map((item) => (
              <RecurringRow key={item.id} item={item} onPay={() => setPaying(item)} onEdit={() => openEdit(item)} />
            ))}
        </ul>
      )}

      {/* Create / edit form dialog — key forces remount on every open so useState
          initializer always sees the current expense (base-nova doesn't call
          onOpenChange on external open) */}
      <RecurringExpenseForm
        key={`${formOpen ? "open" : "closed"}-${editingExpense?.id ?? "create"}`}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        expense={editingExpense}
        recurringVaults={recurringVaults}
        context={formContext}
      />

      <RecurringPayDialog expense={paying} recurringVaults={recurringVaults} onClose={() => setPaying(null)} />
    </section>
  );
}
