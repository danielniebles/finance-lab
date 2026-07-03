"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createVault, updateVault, archiveVault } from "@/lib/actions/vaults";
import { cn } from "@/lib/utils";
import { VaultKind, VaultGoalType } from "@/generated/prisma";
import type { VaultWithMetrics } from "@/lib/queries/vaults";
import { PRESET_COLORS } from "@/lib/color-presets";

// ─── Form state ───────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  kind: VaultKind;
  goalType: VaultGoalType;
  targetAmount: string;
  targetDate: string;
  color: string | null;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  kind: "LEISURE",
  goalType: "FIXED_DEADLINE",
  targetAmount: "",
  targetDate: "",
  color: null,
  notes: "",
};

function toFormState(vault: VaultWithMetrics): FormState {
  return {
    name: vault.name,
    kind: vault.kind,
    goalType: vault.goalType,
    targetAmount: vault.targetAmount !== null ? String(vault.targetAmount) : "",
    targetDate: vault.targetDate
      ? new Date(vault.targetDate).toISOString().slice(0, 10)
      : "",
    color: vault.color,
    notes: vault.notes ?? "",
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  mode: "create" | "edit";
  vault?: VaultWithMetrics | null;
  onClose: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function VaultForm({ open, mode, vault, onClose }: Props) {
  const [form, setForm] = useState<FormState>(() =>
    mode === "edit" && vault ? toFormState(vault) : EMPTY_FORM,
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Called only when base-nova internally closes the dialog (Escape / backdrop).
  // External open is handled by the parent via the `key` prop (remounts the component).
  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      handleClose();
    }
  }

  function handleClose() {
    setForm(EMPTY_FORM);
    setError(null);
    onClose();
  }

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const data = {
      name: form.name.trim(),
      kind: form.kind,
      goalType: form.goalType,
      targetAmount:
        form.goalType === "FIXED_DEADLINE" && form.targetAmount
          ? parseFloat(form.targetAmount)
          : null,
      targetDate:
        form.goalType === "FIXED_DEADLINE" && form.targetDate
          ? new Date(form.targetDate)
          : null,
      color: form.color,
      notes: form.notes.trim() || null,
    };

    if (!data.name) return;

    startTransition(async () => {
      try {
        if (mode === "edit" && vault) {
          await updateVault(vault.id, data);
        } else {
          await createVault(data);
        }
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleArchive() {
    if (!vault) return;
    if (!confirm(`Archive "${vault.name}"? This will hide it from the dashboard.`)) return;

    startTransition(async () => {
      try {
        await archiveVault(vault.id);
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-base font-semibold">
            {mode === "create" ? "New vault" : "Edit vault"}
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-5 pt-2" onSubmit={handleSubmit}>
          {/* Name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="vault-name"
              className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Name
            </Label>
            <Input
              id="vault-name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Emergency Fund"
              required
              disabled={pending}
            />
          </div>

          {/* Kind picker */}
          <div className="space-y-1.5">
            <Label className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Kind
            </Label>
            <div className="flex gap-2" role="radiogroup" aria-label="Vault kind">
              <button
                type="button"
                role="radio"
                aria-checked={form.kind === "MANDATORY"}
                disabled={pending}
                className={cn(
                  "flex-1 h-8 rounded-lg text-sm font-medium transition-colors",
                  form.kind === "MANDATORY"
                    ? "bg-destructive/10 text-destructive ring-1 ring-destructive/30"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
                )}
                onClick={() => setField("kind", "MANDATORY")}
              >
                Mandatory
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={form.kind === "LEISURE"}
                disabled={pending}
                className={cn(
                  "flex-1 h-8 rounded-lg text-sm font-medium transition-colors",
                  form.kind === "LEISURE"
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
                )}
                onClick={() => setField("kind", "LEISURE")}
              >
                Leisure
              </button>
            </div>
          </div>

          {/* Goal type picker */}
          <div className="space-y-1.5">
            <Label className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Goal type
            </Label>
            <div className="flex gap-2" role="radiogroup" aria-label="Goal type">
              <button
                type="button"
                role="radio"
                aria-checked={form.goalType === "FIXED_DEADLINE"}
                disabled={pending}
                className={cn(
                  "flex-1 h-8 rounded-lg text-sm font-medium transition-colors",
                  form.goalType === "FIXED_DEADLINE"
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
                )}
                onClick={() => setField("goalType", "FIXED_DEADLINE")}
              >
                Fixed deadline
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={form.goalType === "OPEN_ENDED"}
                disabled={pending}
                className={cn(
                  "flex-1 h-8 rounded-lg text-sm font-medium transition-colors",
                  form.goalType === "OPEN_ENDED"
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
                )}
                onClick={() => setField("goalType", "OPEN_ENDED")}
              >
                Open-ended
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={form.goalType === "RECURRING"}
                disabled={pending}
                className={cn(
                  "flex-1 h-8 rounded-lg text-sm font-medium transition-colors",
                  form.goalType === "RECURRING"
                    ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70",
                )}
                onClick={() => setField("goalType", "RECURRING")}
              >
                Sinking fund
              </button>
            </div>
            {form.goalType === "RECURRING" && (
              <p className="text-xs text-muted-foreground pt-0.5">
                This vault is funded by linked recurring expenses. Set-aside is computed automatically.
              </p>
            )}
          </div>

          {/* FIXED_DEADLINE fields */}
          {form.goalType === "FIXED_DEADLINE" && (
            <>
              <div className="space-y-1.5">
                <Label
                  htmlFor="target-amount"
                  className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Target amount (COP)
                </Label>
                <Input
                  id="target-amount"
                  type="number"
                  min="1"
                  value={form.targetAmount}
                  onChange={(e) => setField("targetAmount", e.target.value)}
                  placeholder="1200000"
                  required
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="target-date"
                  className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Deadline
                </Label>
                <Input
                  id="target-date"
                  type="date"
                  value={form.targetDate}
                  onChange={(e) => setField("targetDate", e.target.value)}
                  required
                  disabled={pending}
                />
              </div>
            </>
          )}

          {/* Color picker */}
          <div className="space-y-1.5">
            <Label className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Color{" "}
              <span className="text-muted-foreground font-normal normal-case tracking-normal">
                (optional)
              </span>
            </Label>
            <div className="flex gap-2 flex-wrap items-center">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-label={`${c.label}${form.color === c.value ? " (selected)" : ""}`}
                  aria-pressed={form.color === c.value}
                  disabled={pending}
                  className={cn(
                    "size-6 rounded-full transition-all",
                    form.color === c.value
                      ? "ring-2 ring-offset-2 ring-offset-background ring-foreground/60 scale-110"
                      : "hover:scale-105",
                  )}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setField("color", c.value)}
                />
              ))}
              {/* Clear color */}
              <button
                type="button"
                aria-label="No color"
                aria-pressed={form.color === null}
                disabled={pending}
                className={cn(
                  "size-6 rounded-full border border-border bg-muted transition-all flex items-center justify-center",
                  form.color === null
                    ? "ring-2 ring-offset-2 ring-offset-background ring-foreground/60"
                    : "",
                )}
                onClick={() => setField("color", null)}
              >
                <X className="size-3 text-muted-foreground" aria-hidden />
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label
              htmlFor="vault-notes"
              className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Notes{" "}
              <span className="text-muted-foreground font-normal normal-case tracking-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="vault-notes"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="What are you saving for?"
              disabled={pending}
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            {mode === "edit" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 mr-auto"
                onClick={handleArchive}
                disabled={pending}
              >
                Archive vault
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Saving…"
                  : mode === "create"
                  ? "Create vault"
                  : "Save changes"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
