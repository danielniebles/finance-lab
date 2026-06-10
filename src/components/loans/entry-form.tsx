"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { createEntry } from "@/lib/actions/loans";
import { EntryType } from "@/generated/prisma/enums";
import type { AccountWithBalance } from "@/lib/queries/loans";

export function EntryForm({
  open,
  onClose,
  account,
}: {
  open: boolean;
  onClose: () => void;
  account: AccountWithBalance;
}) {
  const [type, setType] = useState<EntryType>(EntryType.ADJUSTMENT);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed)) return;
    startTransition(async () => {
      await createEntry({
        accountId: account.id,
        type,
        amount: parsed,
        date: new Date(date + "T12:00:00"),
        notes: notes.trim() || undefined,
      });
      setAmount("");
      setNotes("");
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Add entry —{" "}
            <span style={{ color: account.color ?? undefined }}>{account.name}</span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Entry type</Label>
            <Select value={type} onValueChange={(v) => v && setType(v as EntryType)}>
              <SelectTrigger className="h-9">
                <span className="text-sm">
                  {type === EntryType.INITIAL ? "Opening balance" : "Income / Adjustment"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EntryType.INITIAL}>Opening balance</SelectItem>
                <SelectItem value={EntryType.ADJUSTMENT}>Income / Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Amount (COP)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1500000 or -500000"
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Use a negative value to record a deduction or correction.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Salary deposit, Bono"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>Add entry</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
