"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createRecurringExpense, updateRecurringExpense } from "@/lib/actions/recurring";
import type { RecurringExpenseRow } from "@/lib/queries/recurring";
import type { VaultWithMetrics } from "@/lib/queries/vaults";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
  vault?: VaultWithMetrics;
  expense?: RecurringExpenseRow;
  recurringVaults: VaultWithMetrics[];
};

// ─── Cadence options ──────────────────────────────────────────────────────────

const CADENCE_OPTIONS = [
  { label: "Monthly",     value: "1" },
  { label: "Quarterly",   value: "3" },
  { label: "Semiannual",  value: "6" },
  { label: "Annual",      value: "12" },
  { label: "Custom",      value: "custom" },
];

function cadenceToSelectValue(months: number): string {
  if ([1, 3, 6, 12].includes(months)) return String(months);
  return "custom";
}

// ─── Form state ───────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  estimatedAmount: string;
  cadenceSelect: string;
  cadenceCustom: string;
  nextDueDate: string;
  category: string;
  fundingVaultId: string;
  notes: string;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function toFormState(
  expense: RecurringExpenseRow,
): FormState {
  return {
    name: expense.name,
    estimatedAmount: String(expense.estimatedAmount),
    cadenceSelect: cadenceToSelectValue(expense.cadenceMonths),
    cadenceCustom: String(expense.cadenceMonths),
    nextDueDate: new Date(expense.nextDueDate).toISOString().slice(0, 10),
    category: expense.category ?? "",
    fundingVaultId: expense.fundingVaultId ?? "",
    notes: "",
  };
}

function emptyForm(vaultId?: string): FormState {
  return {
    name: "",
    estimatedAmount: "",
    cadenceSelect: "1",
    cadenceCustom: "",
    nextDueDate: today(),
    category: "",
    fundingVaultId: vaultId ?? "",
    notes: "",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecurringExpenseForm({
  open,
  onClose,
  vault,
  expense,
  recurringVaults,
}: Props) {
  const isEdit = !!expense;
  const [form, setForm] = useState<FormState>(() =>
    isEdit && expense ? toFormState(expense) : emptyForm(vault?.id),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Called only when base-nova internally closes the dialog (Escape / backdrop).
  // External open is handled by the parent via the `key` prop (remounts the component).
  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      handleClose();
    }
  }

  function handleClose() {
    setError(null);
    onClose();
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function resolvedCadence(): number {
    if (form.cadenceSelect === "custom") {
      return parseInt(form.cadenceCustom, 10) || 1;
    }
    return parseInt(form.cadenceSelect, 10);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const data = {
      name: form.name.trim(),
      estimatedAmount: parseFloat(form.estimatedAmount),
      cadenceMonths: resolvedCadence(),
      nextDueDate: new Date(form.nextDueDate),
      category: form.category.trim() || null,
      fundingVaultId: form.fundingVaultId || null,
      notes: form.notes.trim() || null,
    };

    if (!data.name || isNaN(data.estimatedAmount) || data.estimatedAmount <= 0) return;

    startTransition(async () => {
      try {
        if (isEdit && expense) {
          await updateRecurringExpense(expense.id, data);
        } else {
          await createRecurringExpense(data);
        }
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-base font-semibold">
            {isEdit ? "Edit recurring expense" : "New recurring expense"}
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-5 pt-2" onSubmit={handleSubmit}>
          {/* Name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="re-name"
              className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Name
            </Label>
            <Input
              id="re-name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Car insurance"
              required
              disabled={pending}
            />
          </div>

          {/* Estimated amount */}
          <div className="space-y-1.5">
            <Label
              htmlFor="re-amount"
              className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Estimated amount (COP)
            </Label>
            <Input
              id="re-amount"
              type="number"
              min="1"
              value={form.estimatedAmount}
              onChange={(e) => setField("estimatedAmount", e.target.value)}
              placeholder="1200000"
              required
              disabled={pending}
              className="font-mono"
            />
          </div>

          {/* Cadence */}
          <div className="space-y-1.5">
            <Label className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cadence
            </Label>
            <Select
              value={form.cadenceSelect}
              onValueChange={(v) => v && setField("cadenceSelect", v)}
            >
              <SelectTrigger className="w-full" disabled={pending}>
                <SelectValue placeholder="Select cadence" />
              </SelectTrigger>
              <SelectContent>
                {CADENCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.cadenceSelect === "custom" && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  min="1"
                  max="120"
                  value={form.cadenceCustom}
                  onChange={(e) => setField("cadenceCustom", e.target.value)}
                  placeholder="e.g. 2"
                  disabled={pending}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">months</span>
              </div>
            )}
          </div>

          {/* Next due date */}
          <div className="space-y-1.5">
            <Label
              htmlFor="re-due"
              className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Next due date
            </Label>
            <Input
              id="re-due"
              type="date"
              value={form.nextDueDate}
              onChange={(e) => setField("nextDueDate", e.target.value)}
              required
              disabled={pending}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label
              htmlFor="re-category"
              className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Category{" "}
              <span className="font-normal normal-case tracking-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="re-category"
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
              placeholder="e.g. Vehicle, Taxes"
              disabled={pending}
            />
          </div>

          {/* Funding vault */}
          {recurringVaults.length > 0 && (
            <div className="space-y-1.5">
              <Label className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Funding vault{" "}
                <span className="font-normal normal-case tracking-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Select
                value={form.fundingVaultId}
                onValueChange={(v) => setField("fundingVaultId", v ?? "")}
              >
                <SelectTrigger className="w-full" disabled={pending}>
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

          {/* Notes */}
          <div className="space-y-1.5">
            <Label
              htmlFor="re-notes"
              className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Notes{" "}
              <span className="font-normal normal-case tracking-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="re-notes"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Extra context"
              disabled={pending}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : isEdit
                ? "Save changes"
                : "Create expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
