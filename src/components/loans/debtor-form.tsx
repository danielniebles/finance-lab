"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { createDebtor, updateDebtor } from "@/lib/actions/loans";
import type { DebtorWithLoans } from "@/lib/queries/loans";

type FormState = { error?: string } | null;

type EditingDebtor = Pick<DebtorWithLoans, "id" | "name" | "notes">;

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : editing ? "Save" : "Add debtor"}
    </Button>
  );
}

/** Inner form — keyed so it remounts fresh when editing target changes. */
function DebtorFormInner({
  editing,
  onClose,
}: {
  editing: EditingDebtor | null;
  onClose: () => void;
}) {
  const [state, action] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => {
      try {
        const name = (formData.get("name") as string).trim();
        const notes = (formData.get("notes") as string).trim() || undefined;
        if (editing) {
          await updateDebtor(editing.id, { name, notes });
        } else {
          await createDebtor({ name, notes });
        }
        onClose();
        return null;
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Something went wrong" };
      }
    },
    null
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input
          name="name"
          defaultValue={editing?.name ?? ""}
          placeholder="e.g. Maria"
          autoFocus
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label>Notes (optional)</Label>
        <Input
          name="notes"
          defaultValue={editing?.notes ?? ""}
          placeholder="Optional notes"
        />
      </div>
      {state?.error && (
        <p className="text-destructive text-sm">{state.error}</p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <SubmitButton editing={!!editing} />
      </DialogFooter>
    </form>
  );
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
  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit debtor" : "Add debtor"}</DialogTitle>
        </DialogHeader>
        <DebtorFormInner key={editing?.id ?? "new"} editing={editing} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
