"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormDialog, FormFooter } from "@/components/ds";
import { createDebtor, updateDebtor } from "@/lib/actions/loans";
import { TONE_CLASSES } from "@/lib/status";
import type { DebtorWithLoans } from "@/lib/queries/loans";

type EditingDebtor = Pick<DebtorWithLoans, "id" | "name" | "notes">;

function savedValues(editing: EditingDebtor | null) {
  return { name: editing?.name ?? "", notes: editing?.notes ?? "" };
}

function errorHint(error: string | null) {
  return error ? <span className={TONE_CLASSES.danger.text}>{error}</span> : undefined;
}

export function DebtorForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: EditingDebtor | null;
}) {
  const [name, setName] = useState(() => savedValues(editing).name);
  const [notes, setNotes] = useState(() => savedValues(editing).notes);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Stays mounted between opens: load the saved values each time it opens.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      const saved = savedValues(editing);
      setName(saved.name);
      setNotes(saved.notes);
      setError(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      try {
        // null clears the notes on edit (undefined would keep the old ones).
        if (editing) await updateDebtor(editing.id, { name: trimmed, notes: notes.trim() || null });
        else await createDebtor({ name: trimmed, notes: notes.trim() || undefined });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? `Edit ${editing.name}` : "Add debtor"}
      onSubmit={handleSubmit}
      footer={
        <FormFooter hint={errorHint(error)}>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Saving…" : editing ? "Save changes" : "Add debtor"}
          </Button>
        </FormFooter>
      }
    >
      <Field label="Name" htmlFor="debtor-name">
        <Input id="debtor-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Maria" autoFocus required disabled={pending} />
      </Field>
      <Field label="Notes" htmlFor="debtor-notes" optional>
        <Input id="debtor-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How you know them, contact…" disabled={pending} />
      </Field>
    </FormDialog>
  );
}
