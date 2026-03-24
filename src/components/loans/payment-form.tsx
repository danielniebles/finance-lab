"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { recordPayment } from "@/lib/actions/loans";
import { formatCOP } from "@/lib/format";
import type { DebtorWithLoans } from "@/lib/queries/loans";

export function PaymentForm({
  open,
  onClose,
  debtors,
  defaultDebtorId,
}: {
  open: boolean;
  onClose: () => void;
  debtors: DebtorWithLoans[];
  defaultDebtorId?: string;
}) {
  const [debtorId, setDebtorId] = useState(defaultDebtorId ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const debtor = debtors.find((d) => d.id === debtorId);

  // Preview FIFO allocation
  const preview = useMemo(() => {
    if (!debtor || !amount) return [];
    const total = parseFloat(amount);
    if (isNaN(total) || total <= 0) return [];

    const activeLoans = debtor.loans
      .filter((l) => l.isActive)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let left = total;
    return activeLoans.map((l) => {
      if (left <= 0) return null;
      const apply = Math.min(left, l.remaining);
      left -= apply;
      return { loan: l, apply };
    }).filter(Boolean) as { loan: (typeof activeLoans)[0]; apply: number }[];
  }, [debtor, amount]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await recordPayment({
        debtorId,
        totalAmount: parseFloat(amount),
        date: new Date(date + "T12:00:00"),
        notes: notes.trim() || undefined,
      });
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Debtor</Label>
            <Select value={debtorId} onValueChange={(v) => v && setDebtorId(v)}>
              <SelectTrigger className="h-9">
                <span className="text-sm">
                  {debtor ? `${debtor.name} — owes ${formatCOP(debtor.totalOwed)}` : "Select debtor…"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {debtors.filter((d) => d.totalOwed > 0).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} — {formatCOP(d.totalOwed)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount received (COP)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="800000"
                min={1}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          {/* FIFO preview */}
          {preview.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Allocation preview (oldest first)
              </p>
              {preview.map(({ loan, apply }) => (
                <div key={loan.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {new Date(loan.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    <span className="text-muted-foreground/50 ml-1">· {loan.accountName}</span>
                  </span>
                  <span className="font-mono text-emerald-400">+{formatCOP(apply)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending || !debtorId || !amount}>Record payment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
