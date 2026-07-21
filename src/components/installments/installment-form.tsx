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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { createInstallment, updateInstallment, deleteInstallment } from "@/lib/actions/installments";
import { computeInstallmentDue, eaToMonthly, monthlyToEA } from "@/lib/installment-utils";
import { cn } from "@/lib/utils";
import type { InstallmentRow } from "@/lib/queries/installments";

type RateType = "monthly" | "annual_ea";

type FormState = {
  description: string;
  totalAmount: string;
  numInstallments: string;
  interestRate: string; // always the value as displayed (m.v. or EA depending on rateType)
  rateType: RateType;
  startDate: string; // "YYYY-MM-DD"
  notes: string;
  cardId: string | null;
  debtorId: string | null;
  fundingAccountId: string | null;
};

const EMPTY: FormState = {
  description: "",
  totalAmount: "",
  numInstallments: "1",
  interestRate: "",
  rateType: "monthly",
  startDate: "",
  notes: "",
  cardId: null,
  debtorId: null,
  fundingAccountId: null,
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
    // stored value is always monthly — display as m.v.
    interestRate: row.monthlyInterestRate != null ? row.monthlyInterestRate.toFixed(4) : "",
    rateType: "monthly",
    startDate: `${yyyy}-${mm}-${dd}`,
    notes: row.notes ?? "",
    cardId: row.cardId,
    debtorId: row.debtorId,
    fundingAccountId: row.fundingAccountId,
  };
}

export function InstallmentForm({
  open,
  onClose,
  editing,
  cards = [],
  debtors = [],
  accounts = [],
}: {
  open: boolean;
  onClose: () => void;
  editing: InstallmentRow | null;
  cards?: { id: string; name: string; color: string | null }[];
  debtors?: { id: string; name: string }[];
  accounts?: { id: string; name: string }[];
}) {
  const [form, setForm] = useState<FormState>(() =>
    editing ? toFormState(editing) : EMPTY
  );
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Re-sync whenever the dialog transitions to open — each row now owns a
  // dedicated form instance (editing is fixed per instance), so the reset
  // needs to key off `open`, not `editing` changing.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setForm(editing ? toFormState(editing) : EMPTY);
      setConfirmingDelete(false);
    }
  }

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  /** Switch rate type, converting the displayed value so the user doesn't lose context. */
  function switchRateType(next: RateType) {
    if (next === form.rateType) return;
    const current = parseFloat(form.interestRate);
    let converted = "";
    if (!isNaN(current) && current > 0) {
      if (next === "annual_ea") {
        // monthly → EA
        converted = monthlyToEA(current).toFixed(2);
      } else {
        // EA → monthly
        converted = (eaToMonthly(current) * 100).toFixed(4);
      }
    }
    setForm((prev) => ({ ...prev, rateType: next, interestRate: converted }));
  }

  /** Returns the monthly rate (% m.v.) to store, regardless of input mode. */
  function getMonthlyRate(): number | null {
    const v = parseFloat(form.interestRate);
    if (!form.interestRate.trim() || isNaN(v) || v <= 0) return null;
    if (form.rateType === "monthly") return v;
    return parseFloat((eaToMonthly(v) * 100).toFixed(4));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      description: form.description.trim(),
      totalAmount: parseFloat(form.totalAmount),
      numInstallments: parseInt(form.numInstallments, 10),
      monthlyInterestRate: getMonthlyRate(),
      startDate: new Date(form.startDate + "T12:00:00"),
      notes: form.notes.trim() || undefined,
      cardId: form.cardId,
      debtorId: form.debtorId,
      fundingAccountId: form.fundingAccountId,
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

  function handleDelete() {
    if (!editing) return;
    startTransition(async () => {
      await deleteInstallment(editing.id);
      onClose();
    });
  }

  // Live preview — always compute using monthly rate
  const totalAmount = parseFloat(form.totalAmount);
  const numInstallments = parseInt(form.numInstallments, 10);
  const monthlyRate = getMonthlyRate();
  const hasValidInputs = !isNaN(totalAmount) && !isNaN(numInstallments) && numInstallments > 0;
  const firstInstallment = hasValidInputs
    ? computeInstallmentDue(totalAmount, numInstallments, 1, monthlyRate)
    : null;
  const lastInstallment = hasValidInputs && monthlyRate && numInstallments > 1
    ? computeInstallmentDue(totalAmount, numInstallments, numInstallments, monthlyRate)
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {confirmingDelete
              ? "Delete installment?"
              : editing ? "Edit installment" : "New installment"}
          </DialogTitle>
        </DialogHeader>
        {confirmingDelete ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">
              Delete this installment and all its payment records?
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmingDelete(false)} autoFocus>
                Cancel
              </Button>
              <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
                Confirm delete
              </Button>
            </DialogFooter>
          </div>
        ) : (
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

          {/* Interest rate with m.v. / EA toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="interestRate">
                Interest rate{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              {/* Type toggle */}
              <div className="flex rounded-md border border-input overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => switchRateType("monthly")}
                  className={cn(
                    "px-2.5 py-1 transition-colors",
                    form.rateType === "monthly"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  % m.v.
                </button>
                <button
                  type="button"
                  onClick={() => switchRateType("annual_ea")}
                  className={cn(
                    "px-2.5 py-1 transition-colors border-l border-input",
                    form.rateType === "annual_ea"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  % EA
                </button>
              </div>
            </div>
            <Input
              id="interestRate"
              type="number"
              min={0}
              step={0.01}
              value={form.interestRate}
              onChange={(e) => set("interestRate", e.target.value)}
              placeholder={
                form.rateType === "monthly"
                  ? "e.g. 1.89  (as shown on statement)"
                  : "e.g. 25.37  (effective annual)"
              }
            />
            {form.rateType === "monthly" && (
              <p className="text-xs text-muted-foreground/70">
                Mensual vencido — read directly from your credit card statement.
              </p>
            )}
            {form.rateType === "annual_ea" && (
              <p className="text-xs text-muted-foreground/70">
                Efectiva anual — will be converted to monthly for calculation.
              </p>
            )}
          </div>

          {firstInstallment !== null && !isNaN(firstInstallment) && (
            <p className="text-xs text-muted-foreground font-mono">
              {lastInstallment !== null ? (
                <>
                  First: ${new Intl.NumberFormat("es-CO").format(firstInstallment)} →{" "}
                  Last: ${new Intl.NumberFormat("es-CO").format(lastInstallment)} COP
                  <span className="ml-1 text-muted-foreground/60">(cuota decreciente)</span>
                </>
              ) : (
                <>Monthly: ${new Intl.NumberFormat("es-CO").format(firstInstallment)} COP</>
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

          {/* Optional links */}
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Optional links
            </p>

            {/* Card picker */}
            <div className="space-y-1.5">
              <Label>
                Credit card{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select
                value={form.cardId ?? ""}
                onValueChange={(v) => set("cardId", v || null)}
              >
                <SelectTrigger className="h-8">
                  <span className="text-sm">
                    {form.cardId
                      ? (cards.find((c) => c.id === form.cardId)?.name ?? "Unknown card")
                      : "None"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {cards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Debtor picker */}
            <div className="space-y-1.5">
              <Label>
                For debtor{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select
                value={form.debtorId ?? ""}
                onValueChange={(v) => {
                  set("debtorId", v || null);
                  if (!v) set("fundingAccountId", null);
                }}
              >
                <SelectTrigger className="h-8">
                  <span className="text-sm">
                    {form.debtorId
                      ? (debtors.find((d) => d.id === form.debtorId)?.name ?? "Unknown debtor")
                      : "None"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {debtors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Funding account picker — conditional on debtorId */}
            {form.debtorId && (
              <div className="space-y-1.5">
                <Label>
                  Funding account{" "}
                  <span className="text-muted-foreground font-normal">
                    (the account you paid from)
                  </span>
                </Label>
                <Select
                  value={form.fundingAccountId ?? ""}
                  onValueChange={(v) => set("fundingAccountId", v || null)}
                >
                  <SelectTrigger className="h-8">
                    <span className="text-sm">
                      {form.fundingAccountId
                        ? (accounts.find((a) => a.id === form.fundingAccountId)?.name ?? "Unknown account")
                        : "None"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground/70">
                  Each cuota paid will create a Loan record under this debtor.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            {editing && (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                disabled={pending}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {editing ? "Save changes" : "Add installment"}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
