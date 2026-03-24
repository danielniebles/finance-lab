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
import { createTransfer } from "@/lib/actions/loans";
import type { AccountWithBalance } from "@/lib/queries/loans";

export function TransferForm({
  open,
  onClose,
  accounts,
}: {
  open: boolean;
  onClose: () => void;
  accounts: AccountWithBalance[];
}) {
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [toId, setToId] = useState(accounts[1]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (fromId === toId) return;
    startTransition(async () => {
      await createTransfer({
        fromAccountId: fromId,
        toAccountId: toId,
        amount: parseFloat(amount),
        date: new Date(date + "T12:00:00"),
        notes: notes.trim() || undefined,
      });
      onClose();
    });
  }

  function AccountOption({ account }: { account: AccountWithBalance }) {
    return (
      <span className="flex items-center gap-2">
        <span className="size-2.5 rounded-full inline-block" style={{ backgroundColor: account.color ?? "#888" }} />
        {account.name}
      </span>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer between accounts</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Select value={fromId} onValueChange={(v) => v && setFromId(v)}>
                <SelectTrigger className="h-9">
                  <span className="text-sm">{from ? <AccountOption account={from} /> : "Select…"}</span>
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}><AccountOption account={a} /></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Select value={toId} onValueChange={(v) => v && setToId(v)}>
                <SelectTrigger className="h-9">
                  <span className="text-sm">{to ? <AccountOption account={to} /> : "Select…"}</span>
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter((a) => a.id !== fromId).map((a) => (
                    <SelectItem key={a.id} value={a.id}><AccountOption account={a} /></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (COP)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1000000"
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
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending || fromId === toId || !amount}>Transfer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
