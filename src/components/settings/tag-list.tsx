"use client";

import { useState, useTransition } from "react";
import { createTag, updateTag, deleteTag } from "@/lib/actions/tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Plus, Check, X } from "lucide-react";
import type { TagSettingsRow } from "@/lib/queries/tags";

type CategoryOption = { id: string; name: string };

const NONE_CATEGORY = "__none__";

function DefaultCategorySelect({
  value,
  categories,
  onChange,
  className = "h-8 w-44",
}: {
  value: string;
  categories: CategoryOption[];
  onChange: (v: string) => void;
  className?: string;
}) {
  const selectedName = categories.find((c) => c.id === value)?.name ?? "No default";
  return (
    <Select value={value || NONE_CATEGORY} onValueChange={(v) => v && onChange(v === NONE_CATEGORY ? "" : v)}>
      <SelectTrigger className={className} aria-label="Default category">
        <span className="text-sm truncate">{value ? selectedName : "No default"}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_CATEGORY}>No default</SelectItem>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type TagFormValues = { name: string; defaultAppCategoryId: string };

function formValuesFromTag(tag: TagSettingsRow): TagFormValues {
  return { name: tag.name, defaultAppCategoryId: tag.defaultAppCategoryId ?? "" };
}

// Click-to-open edit dialog (name + default category + a confirm-delete
// step) — mirrors category-list.tsx's CategoryEditDialog. Replaces an
// earlier hover-reveal edit/delete affordance that never showed on mobile
// (no hover state on touch), which is why every other settings list in this
// app already uses "tap the row to edit" instead.
function TagEditDialog({
  tag,
  categories,
  open,
  onClose,
}: {
  tag: TagSettingsRow;
  categories: CategoryOption[];
  open: boolean;
  onClose: () => void;
}) {
  const [values, setValues] = useState<TagFormValues>(() => formValuesFromTag(tag));
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Reset whenever the dialog (re)opens.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setValues(formValuesFromTag(tag));
      setConfirmingDelete(false);
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await updateTag(tag.id, {
        name: values.name,
        defaultAppCategoryId: values.defaultAppCategoryId || null,
      });
      onClose();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteTag(tag.id);
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{confirmingDelete ? "Delete tag?" : "Edit tag"}</DialogTitle>
        </DialogHeader>
        {confirmingDelete ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">
              Delete &quot;#{tag.name}&quot;? It will be removed from every transaction.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmingDelete(false)} autoFocus>
                Cancel
              </Button>
              <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
                Confirm delete
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                value={values.name}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Default category</Label>
              <DefaultCategorySelect
                value={values.defaultAppCategoryId}
                categories={categories}
                onChange={(v) => setValues((val) => ({ ...val, defaultAppCategoryId: v }))}
                className="h-8 w-full"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                disabled={pending}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                Save changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TagRow({
  tag,
  categories,
}: {
  tag: TagSettingsRow;
  categories: CategoryOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/20"
      >
        <span className="inline-flex w-fit shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          #{tag.name}
        </span>
        {tag.defaultAppCategoryName && (
          <>
            <span className="text-muted-foreground text-sm">→</span>
            <span className="text-sm truncate">{tag.defaultAppCategoryName}</span>
          </>
        )}
        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          {tag.transactionCount} transaction{tag.transactionCount !== 1 ? "s" : ""}
        </span>
      </button>
      <TagEditDialog tag={tag} categories={categories} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AddTagRow({
  categories,
  onDone,
}: {
  categories: CategoryOption[];
  onDone: () => void;
}) {
  const [values, setValues] = useState<TagFormValues>({ name: "", defaultAppCategoryId: "" });
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await createTag({
        name: values.name,
        defaultAppCategoryId: values.defaultAppCategoryId || null,
      });
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-4 border-t border-border">
      <Input
        value={values.name}
        onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
        placeholder="e.g. uber"
        className="h-8 w-40 text-sm"
        autoFocus
        required
      />
      <DefaultCategorySelect
        value={values.defaultAppCategoryId}
        categories={categories}
        onChange={(v) => setValues((val) => ({ ...val, defaultAppCategoryId: v }))}
      />
      <div className="flex gap-1 ml-auto">
        <Button type="submit" size="icon" className="size-8" disabled={pending} aria-label="Create tag">
          <Check className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Cancel" onClick={onDone}>
          <X className="size-4" />
        </Button>
      </div>
    </form>
  );
}

export function TagList({
  tags,
  categories,
}: {
  tags: TagSettingsRow[];
  categories: CategoryOption[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {tags.map((tag) => (
        <TagRow key={tag.id} tag={tag} categories={categories} />
      ))}

      {tags.length === 0 && !adding && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          No tags yet. Add one below.
        </div>
      )}

      {adding ? (
        <AddTagRow categories={categories} onDone={() => setAdding(false)} />
      ) : (
        <div className="p-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-5" />
            Add tag
          </Button>
        </div>
      )}
    </div>
  );
}
