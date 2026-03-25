"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { createDebtor, updateDebtor } from "@/lib/actions/loans";
import type { DebtorWithLoans } from "@/lib/queries/loans";

export function DebtorForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Pick<DebtorWithLoans, "id" | "name" | "notes"> | null;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [last, setLast] = useState(editing);
  const [pending, startTransition] = useTransition();

  if (editing !== last) {
    setLast(editing);
    setName(editing?.name ?? "");
    setNotes(editing?.notes ?? "");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      if (editing) {
        await updateDebtor(editing.id, { name: name.trim(), notes: notes.trim() || undefined });
      } else {
        await createDebtor({ name: name.trim(), notes: notes.trim() || undefined });
      }
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit debtor" : "Add debtor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maria"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {editing ? "Save" : "Add debtor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
