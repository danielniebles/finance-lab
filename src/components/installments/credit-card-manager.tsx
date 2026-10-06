"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorDot, ColorPicker, Field, FormDialog, FormFooter, Money, MoneyInput } from "@/components/ds";
import { createCard, updateCard, deleteCard } from "@/lib/actions/installments";
import { DEFAULT_ENTITY_COLOR } from "@/lib/color-presets";
import { amountToDigits } from "@/lib/form-format";
import type { CreditCardSummary } from "@/lib/queries/installments";

export type CardFormState = {
  name: string;
  creditLimit: string; // digits
  billingClosingDay: string;
  paymentDueDay: string;
  color: string;
};

const EMPTY_FORM: CardFormState = {
  name: "",
  creditLimit: "",
  billingClosingDay: "",
  paymentDueDay: "",
  color: DEFAULT_ENTITY_COLOR,
};

/**
 * Form values for an existing card. Loads every stored field: the old form
 * left the credit limit and closing day empty, and saving then wiped them.
 */
export function cardFormState(card: CreditCardSummary): CardFormState {
  return {
    name: card.name,
    creditLimit: amountToDigits(card.creditLimit),
    billingClosingDay: card.billingClosingDay != null ? String(card.billingClosingDay) : "",
    paymentDueDay: card.paymentDueDay != null ? String(card.paymentDueDay) : "",
    color: card.color ?? DEFAULT_ENTITY_COLOR,
  };
}

/** A day of the month typed by hand: 1–31, else undefined. */
export function parseDay(raw: string): number | undefined {
  const n = parseInt(raw, 10);
  return n >= 1 && n <= 31 ? n : undefined;
}

type View = { kind: "list" } | { kind: "form"; card: CreditCardSummary | null } | { kind: "delete"; card: CreditCardSummary };

type Props = {
  open: boolean;
  onClose: () => void;
  cards: CreditCardSummary[];
};

/** Cards list → add/edit form → delete confirm, all inside one modal. */
export function CreditCardManager({ open, onClose, cards }: Props) {
  const [view, setView] = useState<View>({ kind: "list" });
  const [form, setForm] = useState<CardFormState>(EMPTY_FORM);
  const [pending, startTransition] = useTransition();

  const toList = () => setView({ kind: "list" });
  function handleClose() {
    toList();
    onClose();
  }
  function openForm(card: CreditCardSummary | null) {
    setForm(card ? cardFormState(card) : EMPTY_FORM);
    setView({ kind: "form", card });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (view.kind !== "form") return;
    const data = {
      name: form.name.trim(),
      creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
      billingClosingDay: parseDay(form.billingClosingDay),
      paymentDueDay: parseDay(form.paymentDueDay),
      color: form.color || undefined,
    };
    if (!data.name) return;
    startTransition(async () => {
      if (view.card) await updateCard(view.card.id, data);
      else await createCard(data);
      toList();
    });
  }

  function handleDelete(card: CreditCardSummary) {
    startTransition(async () => {
      await deleteCard(card.id);
      toList();
    });
  }

  if (view.kind === "delete") {
    const n = view.card.installmentCount;
    return (
      <FormDialog
        open={open}
        onOpenChange={(o) => !o && handleClose()}
        title={`Delete ${view.card.name}?`}
        footer={
          <FormFooter>
            <Button type="button" variant="outline" onClick={toList} autoFocus>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={() => handleDelete(view.card)}>
              Delete card
            </Button>
          </FormFooter>
        }
      >
        <p className="text-sm text-muted-foreground">
          {n > 0
            ? `Its ${n} active ${n === 1 ? "installment stays" : "installments stay"}, just without a card.`
            : "No active installments use it."}
        </p>
      </FormDialog>
    );
  }

  if (view.kind === "form") {
    return (
      <FormDialog
        open={open}
        onOpenChange={(o) => !o && handleClose()}
        title={view.card ? `Edit ${view.card.name}` : "Add card"}
        onSubmit={handleSubmit}
        footer={
          <FormFooter>
            <Button type="button" variant="outline" onClick={toList}>
              Back
            </Button>
            <Button type="submit" disabled={pending || !form.name.trim()}>
              {view.card ? "Save card" : "Add card"}
            </Button>
          </FormFooter>
        }
      >
        <CardFields form={form} setForm={setForm} />
      </FormDialog>
    );
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && handleClose()}
      title="Credit cards"
      footer={
        <FormFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Close
          </Button>
          <Button type="button" onClick={() => openForm(null)}>
            <Plus aria-hidden />
            Add card
          </Button>
        </FormFooter>
      }
    >
      {cards.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No cards yet.</p>
      ) : (
        <ul className="-mx-5 divide-y divide-border/40">
          {cards.map((card) => (
            <CardRow key={card.id} card={card} onEdit={() => openForm(card)} onDelete={() => setView({ kind: "delete", card })} disabled={pending} />
          ))}
        </ul>
      )}
    </FormDialog>
  );
}

function CardRow({
  card,
  onEdit,
  onDelete,
  disabled,
}: {
  card: CreditCardSummary;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const details = [
    `${card.installmentCount} active ${card.installmentCount === 1 ? "cuota" : "cuotas"}`,
    card.paymentDueDay ? `due day ${card.paymentDueDay}` : null,
  ].filter(Boolean);
  return (
    <li className="flex items-center gap-3 px-5 py-2.5">
      <ColorDot color={card.color} className="size-2.5" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{card.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {details.join(" · ")}
          {card.creditLimit ? (
            <>
              {" · limit "}
              <Money value={card.creditLimit} compact />
            </>
          ) : null}
        </span>
      </span>
      <Button variant="ghost" size="icon" className="size-9" onClick={onEdit} aria-label={`Edit ${card.name}`}>
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-9 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        disabled={disabled}
        aria-label={`Delete ${card.name}`}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}

function CardFields({
  form,
  setForm,
}: {
  form: CardFormState;
  setForm: React.Dispatch<React.SetStateAction<CardFormState>>;
}) {
  const set = <K extends keyof CardFormState>(k: K, v: CardFormState[K]) => setForm((p) => ({ ...p, [k]: v }));
  const day = (raw: string) => raw.replace(/\D/g, "").slice(0, 2);
  return (
    <>
      <Field label="Name" htmlFor="cc-name">
        <Input id="cc-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Nu" required />
      </Field>
      <Field label="Credit limit" htmlFor="cc-limit" optional>
        <MoneyInput id="cc-limit" value={form.creditLimit} onValueChange={(v) => set("creditLimit", v)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Closing day" htmlFor="cc-closing" optional>
          <Input id="cc-closing" inputMode="numeric" value={form.billingClosingDay} onChange={(e) => set("billingClosingDay", day(e.target.value))} placeholder="1–31" className="font-mono" />
        </Field>
        <Field label="Payment due day" htmlFor="cc-due" optional hint="Used for the due chips on Installments.">
          <Input id="cc-due" inputMode="numeric" value={form.paymentDueDay} onChange={(e) => set("paymentDueDay", day(e.target.value))} placeholder="1–31" className="font-mono" />
        </Field>
      </div>
      <Field label="Colour">
        <ColorPicker value={form.color} onChange={(c) => set("color", c ?? DEFAULT_ENTITY_COLOR)} />
      </Field>
    </>
  );
}
