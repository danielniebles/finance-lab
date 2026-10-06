"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormDialog, FormFooter, OptionSelect } from "@/components/ds";
import { CategoryIconTile, categorySelectOptions } from "@/components/shared/category-option";
import { createTag, updateTag, deleteTag } from "@/lib/actions/tags";
import { TONE_CLASSES } from "@/lib/status";
import type { TagSettingsRow } from "@/lib/queries/tags";

type CategoryOption = { id: string; name: string; icon?: string | null; color?: string | null; isTransfer?: boolean };

type TagFormValues = { name: string; defaultAppCategoryId: string | null };

function initial(tag?: TagSettingsRow): TagFormValues {
  return { name: tag?.name ?? "", defaultAppCategoryId: tag?.defaultAppCategoryId ?? null };
}

function errorHint(error: string | null): React.ReactNode {
  return error ? <span className={TONE_CLASSES.danger.text}>{error}</span> : undefined;
}

function DeleteTagStep({ tag, open, onClose, onBack }: { tag: TagSettingsRow; open: boolean; onClose: () => void; onBack: () => void }) {
  const [pending, startTransition] = useTransition();
  const n = tag.transactionCount;
  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Delete #${tag.name}?`}
      footer={
        <FormFooter>
          <Button type="button" variant="outline" onClick={onBack} autoFocus>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await deleteTag(tag.id);
                onClose();
              })
            }
          >
            Delete tag
          </Button>
        </FormFooter>
      }
    >
      <p className="text-sm text-muted-foreground">
        {n > 0 ? `It comes off ${n} ${n === 1 ? "transaction" : "transactions"}; the transactions stay.` : "No transactions use it."}
      </p>
    </FormDialog>
  );
}

/** New tag, or rename / set the default category / delete one (`tag`). */
function TagDialog({
  tag,
  categories,
  open,
  onClose,
}: {
  tag?: TagSettingsRow;
  categories: CategoryOption[];
  open: boolean;
  onClose: () => void;
}) {
  const [values, setValues] = useState<TagFormValues>(() => initial(tag));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setValues(initial(tag));
      setError(null);
      setConfirmingDelete(false);
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        if (tag) await updateTag(tag.id, values);
        else await createTag(values);
        onClose();
      } catch {
        setError("Couldn't save. Is there already a tag with that name?");
      }
    });
  }

  if (confirmingDelete && tag) {
    return <DeleteTagStep tag={tag} open={open} onClose={onClose} onBack={() => setConfirmingDelete(false)} />;
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={tag ? "Edit tag" : "New tag"}
      onSubmit={handleSave}
      footer={
        <FormFooter hint={errorHint(error)}>
          {tag && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
              disabled={pending}
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !values.name.trim()}>
            {pending ? "Saving…" : tag ? "Save changes" : "Add tag"}
          </Button>
        </FormFooter>
      }
    >
      <Field label="Name" htmlFor="tag-name" hint="Saved in lowercase, without the #.">
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">#</span>
          <Input
            id="tag-name"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value.replace(/^#+/, "") }))}
            placeholder="uber"
            className="pl-7"
            autoFocus
            required
            disabled={pending}
          />
        </div>
      </Field>
      <Field label="Default category" optional hint="Lets the Advisor file a message with this #tag straight into this category.">
        <OptionSelect
          ariaLabel="Default category"
          value={values.defaultAppCategoryId}
          onChange={(v) => setValues((val) => ({ ...val, defaultAppCategoryId: v }))}
          noneLabel="No default"
          options={categorySelectOptions(categories.filter((c) => !c.isTransfer))}
          disabled={pending}
        />
      </Field>
    </FormDialog>
  );
}

function TagRow({ tag, categories }: { tag: TagSettingsRow; categories: CategoryOption[] }) {
  const [open, setOpen] = useState(false);
  const category = categories.find((c) => c.id === tag.defaultAppCategoryId);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/20"
      >
        <span className="inline-flex w-fit shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">#{tag.name}</span>
        {tag.defaultAppCategoryName && (
          <span className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="text-muted-foreground" aria-hidden>
              →
            </span>
            <CategoryIconTile category={category ?? { name: tag.defaultAppCategoryName }} />
            <span className="truncate">{tag.defaultAppCategoryName}</span>
          </span>
        )}
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {tag.transactionCount} <span className="max-sm:hidden">transaction{tag.transactionCount !== 1 ? "s" : ""}</span>
        </span>
      </button>
      <TagDialog tag={tag} categories={categories} open={open} onClose={() => setOpen(false)} />
    </li>
  );
}

export function TagList({ tags, categories }: { tags: TagSettingsRow[]; categories: CategoryOption[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <ul className="divide-y divide-border/40">
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} categories={categories} />
          ))}
          {tags.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">No tags yet.</li>}
        </ul>
      </div>
    </div>
  );
}

/** The page's main action: opens a new-tag dialog. */
export function AddTagButton({ categories }: { categories: CategoryOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Add tag
      </Button>
      <TagDialog categories={categories} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
