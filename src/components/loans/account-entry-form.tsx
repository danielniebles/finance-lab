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
import { createEntry } from "@/lib/actions/loans";
import { EntryType } from "@/generated/prisma";
import type { AccountWithBalance } from "@/lib/queries/loans";

type FormState = { error?: string } | null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Add entry"}
    </Button>
  );
}

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

  const [state, action] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      try {
        const amount = parseFloat(formData.get("amount") as string);
        if (isNaN(amount)) return { error: "Invalid amount" };
        const date = formData.get("date") as string;
        const notes = (formData.get("notes") as string).trim() || undefined;
        await createEntry({
          accountId: account.id,
          type,
          amount,
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Add entry —{" "}
            <span style={{ color: account.color ?? undefined }}>{account.name}</span>
          </DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-4">
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
              name="amount"
              type="number"
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
              name="date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input
              name="notes"
              placeholder="e.g. Salary deposit, Bono"
            />
          </div>

          {state?.error && (
            <p className="text-destructive text-sm">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
