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
import { createLoan, updateLoan } from "@/lib/actions/loans";
import type { AccountWithBalance, DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";

export function LoanForm({
  open,
  onClose,
  accounts,
  debtors,
  defaultDebtorId,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  accounts: AccountWithBalance[];
  debtors: DebtorWithLoans[];
  defaultDebtorId?: string;
  editing?: LoanWithRemaining | null;
}) {
  const [debtorId, setDebtorId] = useState(editing?.debtorId ?? defaultDebtorId ?? "");
  const [accountId, setAccountId] = useState(editing?.accountId ?? accounts[0]?.id ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [date, setDate] = useState(
    editing ? new Date(editing.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [expectedBy, setExpectedBy] = useState(
    editing?.expectedBy ? new Date(editing.expectedBy).toISOString().slice(0, 10) : ""
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [last, setLast] = useState(editing);
  const [pending, startTransition] = useTransition();

  if (editing !== last) {
    setLast(editing);
    setDebtorId(editing?.debtorId ?? defaultDebtorId ?? "");
    setAccountId(editing?.accountId ?? accounts[0]?.id ?? "");
    setAmount(editing ? String(editing.amount) : "");
    setDate(editing ? new Date(editing.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setExpectedBy(editing?.expectedBy ? new Date(editing.expectedBy).toISOString().slice(0, 10) : "");
    setNotes(editing?.notes ?? "");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (editing) {
        await updateLoan(editing.id, {
          accountId,
          amount: parseFloat(amount),
          date: new Date(date + "T12:00:00"),
          expectedBy: expectedBy ? new Date(expectedBy + "T12:00:00") : undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await createLoan({
          debtorId,
          accountId,
          amount: parseFloat(amount),
          date: new Date(date + "T12:00:00"),
          expectedBy: expectedBy ? new Date(expectedBy + "T12:00:00") : undefined,
          notes: notes.trim() || undefined,
        });
      }
      onClose();
    });
  }

  const selectedDebtor = debtors.find((d) => d.id === debtorId);
  const selectedAccount = accounts.find((a) => a.id === accountId);

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit loan" : "Record new loan"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Debtor</Label>
            {editing ? (
              <p className="text-sm px-3 py-2 rounded-md border border-border bg-muted/30 text-muted-foreground">
                {selectedDebtor?.name ?? debtorId}
              </p>
            ) : (
            <Select value={debtorId} onValueChange={(v) => v && setDebtorId(v)}>
              <SelectTrigger className="h-9">
                <span className="text-sm">{selectedDebtor?.name ?? "Select debtor…"}</span>
              </SelectTrigger>
              <SelectContent>
                {debtors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>From account</Label>
            <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
              <SelectTrigger className="h-9">
                <span className="text-sm flex items-center gap-2">
                  {selectedAccount && (
                    <span className="size-2.5 rounded-full inline-block" style={{ backgroundColor: selectedAccount.color ?? "#888" }} />
                  )}
                  {selectedAccount?.name ?? "Select account…"}
                </span>
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: a.color ?? "#888" }} />
                      {a.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (COP)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="5000000"
                min={1}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Expected repayment (optional)</Label>
            <Input type="date" value={expectedBy} onChange={(e) => setExpectedBy(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending || !debtorId || !accountId}>{editing ? "Save" : "Record loan"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
