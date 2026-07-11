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
import { formatCOP } from "@/lib/format";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cadenceLabel(months: number): string {
  switch (months) {
    case 1:  return "Monthly";
    case 3:  return "Quarterly";
    case 6:  return "Semiannual";
    case 12: return "Annual";
    default: return `Every ${months} months`;
  }
}

function statusPillClasses(status: RecurringExpenseRow["status"]): string {
  switch (status) {
    case "Funded":      return "bg-success/10 text-success";
    case "Underfunded": return "bg-warning/10 text-warning";
    case "DueSoon":     return "bg-warning/10 text-warning";
    case "Overdue":     return "bg-destructive/10 text-destructive";
  }
}

function dueBadgeClasses(status: RecurringExpenseRow["status"]): string {
  switch (status) {
    case "DueSoon":  return "bg-warning/10 text-warning";
    case "Overdue":  return "bg-destructive/10 text-destructive";
    default:         return "";
  }
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
    <section aria-labelledby="recurring-heading">
      {/* Section header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2
          id="recurring-heading"
          className="font-heading text-base font-semibold text-foreground"
        >
          Recurring expenses
        </h2>
        <Button variant="outline" size="sm" onClick={openCreate}>
          <Plus className="size-4 mr-1.5" aria-hidden="true" />
          Add
        </Button>
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground">
          <p className="text-sm">No recurring expenses yet — add your first to start tracking upcoming bills.</p>
        </div>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-heading text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Name / Category
                  </th>
                  <th className="px-4 py-2.5 text-left font-heading text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Cadence
                  </th>
                  <th className="px-4 py-2.5 text-left font-heading text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Next Due
                  </th>
                  <th className="px-4 py-2.5 text-right font-heading text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Set-aside/mo
                  </th>
                  <th className="px-4 py-2.5 text-left font-heading text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Funding vault
                  </th>
                  <th className="px-4 py-2.5 text-left font-heading text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-right font-heading text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item) => {
                  const dueBadge = dueBadgeClasses(item.status);
                  return (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      {/* Name / Category */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-foreground leading-tight">
                          {item.name}
                        </p>
                        {item.category && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {item.category}
                          </p>
                        )}
                      </td>

                      {/* Cadence */}
                      <td className="px-4 py-3 text-muted-foreground">
                        {cadenceLabel(item.cadenceMonths)}
                      </td>

                      {/* Next Due */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-foreground">
                            {new Date(item.nextDueDate).toLocaleDateString("es-CO", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          {dueBadge && (
                            <span
                              className={cn(
                                "text-[10px] font-semibold uppercase tracking-wider rounded-full px-1.5 py-0.5",
                                dueBadge,
                              )}
                            >
                              {item.status === "DueSoon" ? "Due soon" : item.status}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Set-aside/mo */}
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                        {formatCOP(item.setAsideThisMonth)}
                      </td>

                      {/* Funding vault */}
                      <td className="px-4 py-3">
                        {item.fundingVaultName ? (
                          <span className="text-foreground">{item.fundingVaultName}</span>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-wider rounded-full px-1.5 py-0.5",
                            statusPillClasses(item.status),
                          )}
                        >
                          {item.status === "DueSoon" ? "Due soon" : item.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => openPay(item)}
                          >
                            Pay
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={`Edit ${item.name}`}
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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
