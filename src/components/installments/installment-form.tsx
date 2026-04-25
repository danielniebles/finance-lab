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
  DialogFooter,
} from "@/components/ui/dialog";
import { createInstallment, updateInstallment } from "@/lib/actions/installments";
import { computeMonthlyAmount } from "@/lib/installment-utils";
import type { InstallmentRow } from "@/lib/queries/installments";

type FormState = {
  description: string;
  totalAmount: string;
  numInstallments: string;
  annualInterestRate: string; // "" = no interest
  startDate: string; // "YYYY-MM-DD"
  notes: string;
};

const EMPTY: FormState = {
  description: "",
  totalAmount: "",
  numInstallments: "1",
  annualInterestRate: "",
  startDate: "",
  notes: "",
};

function toFormState(row: InstallmentRow): FormState {
  const d = new Date(row.startDate);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return {
    description: row.description,
    totalAmount: String(row.totalAmount),
    numInstallments: String(row.numInstallments),
    annualInterestRate: row.annualInterestRate != null ? String(row.annualInterestRate) : "",
    startDate: `${yyyy}-${mm}-${dd}`,
    notes: row.notes ?? "",
  };
}

export function InstallmentForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: InstallmentRow | null;
}) {
  const [form, setForm] = useState<FormState>(() =>
    editing ? toFormState(editing) : EMPTY
  );
  const [pending, startTransition] = useTransition();

  // Re-sync when dialog opens with a different item
  const [lastEditing, setLastEditing] = useState(editing);
  if (editing !== lastEditing) {
    setLastEditing(editing);
    setForm(editing ? toFormState(editing) : EMPTY);
  }

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rate = form.annualInterestRate.trim()
      ? parseFloat(form.annualInterestRate)
      : null;
    const data = {
      description: form.description.trim(),
      totalAmount: parseFloat(form.totalAmount),
      numInstallments: parseInt(form.numInstallments, 10),
      annualInterestRate: rate && !isNaN(rate) ? rate : null,
      startDate: new Date(form.startDate + "T12:00:00"),
      notes: form.notes.trim() || undefined,
    };
    if (!data.description || isNaN(data.totalAmount) || isNaN(data.numInstallments)) return;

    startTransition(async () => {
      if (editing) {
        await updateInstallment(editing.id, data);
      } else {
        await createInstallment(data);
      }
      onClose();
    });
  }

  // Live preview using the same formula as the server
  const totalAmount = parseFloat(form.totalAmount);
  const numInstallments = parseInt(form.numInstallments, 10);
  const rateInput = form.annualInterestRate.trim() ? parseFloat(form.annualInterestRate) : null;
  const monthlyPreview =
    !isNaN(totalAmount) && !isNaN(numInstallments) && numInstallments > 0
      ? computeMonthlyAmount(totalAmount, numInstallments, rateInput)
      : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit installment" : "New installment"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. iPhone"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="totalAmount">Total amount (COP)</Label>
              <Input
                id="totalAmount"
                type="number"
                min={0}
                value={form.totalAmount}
                onChange={(e) => set("totalAmount", e.target.value)}
                placeholder="190000"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="numInstallments">Installments</Label>
              <Input
                id="numInstallments"
                type="number"
                min={1}
                value={form.numInstallments}
                onChange={(e) => set("numInstallments", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="annualInterestRate">
              Annual interest rate %{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="annualInterestRate"
              type="number"
              min={0}
              step={0.1}
              value={form.annualInterestRate}
              onChange={(e) => set("annualInterestRate", e.target.value)}
              placeholder="e.g. 24.5 — leave blank for simple split"
            />
          </div>

          {monthlyPreview !== null && !isNaN(monthlyPreview) && (
            <p className="text-xs text-muted-foreground font-mono">
              Monthly: ${new Intl.NumberFormat("es-CO").format(monthlyPreview)} COP
              {rateInput && !isNaN(rateInput) && rateInput > 0 && (
                <span className="ml-1 text-muted-foreground/60">(amortized at {rateInput}% / yr)</span>
              )}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="startDate">First payment date</Label>
            <Input
              id="startDate"
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {editing ? "Save changes" : "Add installment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
