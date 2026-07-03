"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createCard, updateCard, deleteCard } from "@/lib/actions/installments";
import type { CreditCardSummary } from "@/lib/queries/installments";
import { PRESET_COLORS } from "@/lib/color-presets";

// ─── Types ────────────────────────────────────────────────────────────────────

type CardFormState = {
  name: string;
  creditLimit: string;
  billingClosingDay: string;
  paymentDueDay: string;
  color: string;
};

const EMPTY_FORM: CardFormState = {
  name: "",
  creditLimit: "",
  billingClosingDay: "",
  paymentDueDay: "",
  color: "#EAB308",
};

function toFormState(card: CreditCardSummary): CardFormState {
  return {
    name: card.name,
    creditLimit: "",   // creditLimit not exposed in summary — keep empty on edit
    billingClosingDay: "",
    paymentDueDay: card.paymentDueDay != null ? String(card.paymentDueDay) : "",
    color: card.color ?? "#EAB308",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
  cards: CreditCardSummary[];
};

export function CreditCardManager({ open, onClose, cards }: Props) {
  const [editingCard, setEditingCard] = useState<CreditCardSummary | null>(null);
  const [form, setForm] = useState<CardFormState>(EMPTY_FORM);
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function set<K extends keyof CardFormState>(k: K, v: CardFormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function startEdit(card: CreditCardSummary) {
    setEditingCard(card);
    setForm(toFormState(card));
  }

  function cancelEdit() {
    setEditingCard(null);
    setForm(EMPTY_FORM);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name: form.name.trim(),
      creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
      billingClosingDay: form.billingClosingDay ? parseInt(form.billingClosingDay, 10) : undefined,
      paymentDueDay: form.paymentDueDay ? parseInt(form.paymentDueDay, 10) : undefined,
      color: form.color || undefined,
    };
    if (!data.name) return;

    startTransition(async () => {
      if (editingCard) {
        await updateCard(editingCard.id, data);
      } else {
        await createCard(data);
      }
      setEditingCard(null);
      setForm(EMPTY_FORM);
    });
  }

  function handleDelete(id: string) {
    if (deletingId === id) {
      // Second click = confirm
      startTransition(async () => {
        await deleteCard(id);
        setDeletingId(null);
        if (editingCard?.id === id) cancelEdit();
      });
    } else {
      setDeletingId(id);
    }
  }

  function handleClose() {
    setEditingCard(null);
    setForm(EMPTY_FORM);
    setDeletingId(null);
    onClose();
  }

  const isEditing = editingCard !== null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage credit cards</DialogTitle>
        </DialogHeader>

        {/* Card list */}
        {cards.length > 0 && (
          <div className="rounded-lg border border-border divide-y divide-border/60 mb-2">
            {cards.map((card) => (
              <div key={card.id} className="flex items-center gap-3 px-3 py-2.5">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: card.color ?? "#888" }}
                />
                <span className="flex-1 text-sm font-medium truncate">{card.name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {card.installmentCount} cuota{card.installmentCount !== 1 ? "s" : ""}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => startEdit(card)}
                  aria-label={`Edit ${card.name}`}
                >
                  <Pencil className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-7 ${deletingId === card.id ? "text-destructive" : "text-muted-foreground hover:text-destructive"}`}
                  onClick={() => handleDelete(card.id)}
                  disabled={pending}
                  aria-label={deletingId === card.id ? `Confirm delete ${card.name}` : `Delete ${card.name}`}
                  title={deletingId === card.id ? "Click again to confirm" : undefined}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" />
          {isEditing ? "editing" : "or add new"}
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Create / edit form */}
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="cc-name">Name *</Label>
            <Input
              id="cc-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Nu"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cc-limit">
              Credit limit{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="cc-limit"
              type="number"
              min={0}
              value={form.creditLimit}
              onChange={(e) => set("creditLimit", e.target.value)}
              placeholder="e.g. 5000000"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc-closing">
                Closing day{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="cc-closing"
                type="number"
                min={1}
                max={31}
                value={form.billingClosingDay}
                onChange={(e) => set("billingClosingDay", e.target.value)}
                placeholder="e.g. 28"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-due">
                Due day{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="cc-due"
                type="number"
                min={1}
                max={31}
                value={form.paymentDueDay}
                onChange={(e) => set("paymentDueDay", e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => set("color", c.value)}
                  className="size-6 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c.value,
                    borderColor: form.color === c.value ? "white" : "transparent",
                  }}
                  aria-label={c.label}
                  aria-pressed={form.color === c.value}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {isEditing && (
              <Button type="button" variant="outline" size="sm" onClick={cancelEdit} className="flex-1">
                Cancel
              </Button>
            )}
            <Button type="submit" size="sm" disabled={pending} className="flex-1">
              {isEditing ? "Save card" : "Add card"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
