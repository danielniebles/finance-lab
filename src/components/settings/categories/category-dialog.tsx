"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { HeaderAction } from "@/components/ds";
import { Input } from "@/components/ui/input";
import { Field, FormDialog, FormFooter } from "@/components/ds";
import { createAppCategory, deleteAppCategory, updateAppCategory } from "@/lib/actions/categories";
import { TONE_CLASSES } from "@/lib/status";
import type { SettingsCategory } from "./types";

function errorHint(error: string | null): React.ReactNode {
  return error ? <span className={TONE_CLASSES.danger.text}>{error}</span> : undefined;
}

function DeleteCategoryStep({
  cat,
  open,
  onClose,
  onBack,
}: {
  cat: SettingsCategory;
  open: boolean;
  onClose: () => void;
  onBack: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const n = cat.budgetItems.length;

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAppCategory(cat.id);
      if (result?.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Delete ${cat.name}?`}
      footer={
        <FormFooter hint={errorHint(error)}>
          <Button type="button" variant="outline" onClick={onBack} autoFocus>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={pending || !!error} onClick={handleDelete}>
            {pending ? "Deleting…" : "Delete category"}
          </Button>
        </FormFooter>
      }
    >
      <p className="text-sm text-muted-foreground">
        {n > 0 ? `Its ${n} budget ${n === 1 ? "item is" : "items are"} deleted with it. ` : ""}A category that
        transactions or rules still use can&apos;t be deleted.
      </p>
    </FormDialog>
  );
}

function EditFooter({
  editing,
  error,
  pending,
  canSave,
  onDelete,
  onCancel,
}: {
  editing: boolean;
  error: string | null;
  pending: boolean;
  canSave: boolean;
  onDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <FormFooter hint={errorHint(error)}>
      {editing && (
        <Button
          type="button"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
          disabled={pending}
          onClick={onDelete}
        >
          Delete
        </Button>
      )}
      <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
      <Button type="submit" disabled={pending || !canSave}>
        {pending ? "Saving…" : editing ? "Save changes" : "Add category"}
      </Button>
    </FormFooter>
  );
}

/** New category, or rename / delete an existing one (`cat`). */
export function CategoryDialog({ cat, open, onClose }: { cat?: SettingsCategory; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(cat?.name ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Stays mounted between opens: start from the saved name each time.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(cat?.name ?? "");
      setError(null);
      setConfirmingDelete(false);
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      try {
        if (cat) await updateAppCategory(cat.id, { name: trimmed });
        else await createAppCategory({ name: trimmed });
        onClose();
      } catch {
        // Names are unique; that's the usual reason a save fails.
        setError("Couldn't save. Is there already a category with that name?");
      }
    });
  }

  if (confirmingDelete && cat) {
    return <DeleteCategoryStep cat={cat} open={open} onClose={onClose} onBack={() => setConfirmingDelete(false)} />;
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={cat ? "Edit category" : "New category"}
      onSubmit={handleSave}
      footer={
        <EditFooter
          editing={!!cat}
          error={error}
          pending={pending}
          canSave={!!name.trim()}
          onDelete={() => setConfirmingDelete(true)}
          onCancel={onClose}
        />
      }
    >
      <Field label="Name" htmlFor="category-name" hint={cat ? undefined : "Icon and colour are picked from the name; change them later from the list."}>
        <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bills & Utilities" autoFocus required disabled={pending} />
      </Field>
    </FormDialog>
  );
}

/** The page's main action: opens a new-category dialog. */
export function AddCategoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <HeaderAction label="Add category" onClick={() => setOpen(true)} />
      <CategoryDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
