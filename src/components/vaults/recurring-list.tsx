"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Money, SectionHeader, StatusChip } from "@/components/ds";
import { TONE_CLASSES, toneForRecurringStatus } from "@/lib/status";
import { cadenceLabel, daysUntil } from "@/lib/vault-display";
import { cn } from "@/lib/utils";
import { payRecurringExpense } from "@/lib/actions/recurring";
import { RecurringExpenseForm } from "./recurring-expense-form";
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

// ─── Pay dialog state ─────────────────────────────────────────────────────────

type PayState = {
  open: boolean;
  expense: RecurringExpenseRow | null;
  amount: string;
  fromVaultId: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function RecurringList({ recurringData, recurringVaults }: Props) {
  const { items } = recurringData;

  // Create / edit form
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpenseRow | undefined>(undefined);

  // Pay dialog
  const [payState, setPayState] = useState<PayState>({
    open: false,
    expense: null,
    amount: "",
    fromVaultId: "",
  });

  const [payPending, startPayTransition] = useTransition();
  const [payError, setPayError] = useState<string | null>(null);

  function openCreate() {
    setEditingExpense(undefined);
    setFormOpen(true);
  }

  function openEdit(expense: RecurringExpenseRow) {
    setEditingExpense(expense);
    setFormOpen(true);
  }

  function openPay(expense: RecurringExpenseRow) {
    setPayState({
      open: true,
      expense,
      amount: String(expense.estimatedAmount),
      fromVaultId: expense.fundingVaultId ?? "",
    });
    setPayError(null);
  }

  function closePay() {
    setPayState((prev) => ({ ...prev, open: false }));
    setPayError(null);
  }

  function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!payState.expense) return;
    const amount = parseFloat(payState.amount);
    if (isNaN(amount) || amount <= 0) return;
    setPayError(null);

    startPayTransition(async () => {
      try {
        await payRecurringExpense(payState.expense!.id, {
          amount,
          fromVaultId: payState.fromVaultId || undefined,
        });
        closePay();
      } catch (err) {
        setPayError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
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
              <RecurringRow key={item.id} item={item} onPay={() => openPay(item)} onEdit={() => openEdit(item)} />
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
      />

      {/* Pay dialog */}
      {payState.open && payState.expense && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Pay ${payState.expense.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closePay}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-sm rounded-xl bg-card ring-1 ring-foreground/10 p-5 space-y-4">
            <h3 className="font-heading text-base font-semibold text-foreground">
              Pay{" "}
              <span className="text-primary">{payState.expense.name}</span>
            </h3>

            <form className="space-y-4" onSubmit={handlePay}>
              {/* Amount */}
              <div className="space-y-1.5">
                <label
                  htmlFor="pay-amount"
                  className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Amount (COP)
                </label>
                <input
                  id="pay-amount"
                  type="number"
                  min="1"
                  value={payState.amount}
                  onChange={(e) =>
                    setPayState((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  required
                  disabled={payPending}
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm font-mono outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                />
              </div>

              {/* Withdraw from vault — only if fundingVaultId is set */}
              {payState.expense.fundingVaultId && recurringVaults.length > 0 && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="pay-vault"
                    className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Withdraw from vault{" "}
                    <span className="font-normal normal-case tracking-normal text-muted-foreground">
                      (optional)
                    </span>
                  </label>
                  <Select
                    value={payState.fromVaultId}
                    onValueChange={(v) =>
                      setPayState((prev) => ({ ...prev, fromVaultId: v ?? "" }))
                    }
                  >
                    <SelectTrigger className="w-full" disabled={payPending}>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {recurringVaults.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {payError && (
                <p className="text-xs text-destructive" role="alert">
                  {payError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closePay}
                  disabled={payPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={payPending}>
                  {payPending ? "Saving…" : "Record payment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
