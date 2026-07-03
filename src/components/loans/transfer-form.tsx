"use client";

import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
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

type FormState = { error?: string } | null;

function AccountOption({ account }: { account: AccountWithBalance }) {
  return (
    <span className="flex items-center gap-2">
      <span className="size-2.5 rounded-full inline-block" style={{ backgroundColor: account.color ?? "#888" }} />
      {account.name}
    </span>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending ? "Saving…" : "Transfer"}
    </Button>
  );
}

export function TransferForm({
  open,
  onClose,
  accounts,
}: {
  open: boolean;
  onClose: () => void;
  accounts: AccountWithBalance[];
}) {
  // Selects that filter each other must stay as state
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [toId, setToId] = useState(accounts[1]?.id ?? "");
  const [amount, setAmount] = useState("");

  const from = accounts.find((a) => a.id === fromId);
  const to = accounts.find((a) => a.id === toId);

  const [state, action] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      try {
        if (fromId === toId) return { error: "From and To accounts must be different" };
        const date = formData.get("date") as string;
        const notes = (formData.get("notes") as string).trim() || undefined;
        await createTransfer({
          fromAccountId: fromId,
          toAccountId: toId,
          amount: parseFloat(amount),
          date: new Date(date + "T12:00:00"),
          notes,
        });
        onClose();
        return null;
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Something went wrong" };
      }
    },
    null
  );

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer between accounts</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
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
              <Input
                name="date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input name="notes" placeholder="Optional notes" />
          </div>

          {state?.error && (
            <p className="text-destructive text-sm">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <SubmitButton disabled={fromId === toId || !amount} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
