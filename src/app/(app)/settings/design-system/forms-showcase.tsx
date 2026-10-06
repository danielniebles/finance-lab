"use client";

// The ds/form kit in its common states (empty, filled, hint, error,
// disabled), for the design-system reference page. Everything here is local
// state: nothing is saved.

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckField,
  ColorDot,
  ColorPicker,
  DateField,
  Field,
  FieldGroupLabel,
  FormDialog,
  FormFooter,
  FormReadout,
  Money,
  MoneyInput,
  OptionSelect,
  SectionHeader,
  SegmentedControl,
  TagInput,
} from "@/components/ds";
import { categorySelectOptions } from "@/components/shared/category-option";
import { RowDeleteButton } from "@/components/shared/row-delete-button";
import { PRESET_COLORS } from "@/lib/color-presets";

const PANEL = "rounded-2xl border border-border/60 bg-card p-5";

const CATEGORIES = [
  { id: "c1", name: "Mercado" },
  { id: "c2", name: "Restaurantes" },
  { id: "c3", name: "Bills & Utilities" },
];

const ACCOUNTS = [
  { value: "a1", label: "Bancolombia — $ 8.250.000", leading: <ColorDot color={PRESET_COLORS[4].value} /> },
  { value: "a2", label: "Nu — $ 1.200.000", leading: <ColorDot color={PRESET_COLORS[1].value} /> },
];

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <SectionHeader title={title} />
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <div className={PANEL}>{children}</div>
    </section>
  );
}

function FieldStates() {
  const [name, setName] = useState("Bancolombia");
  return (
    <Panel title="Field" note="Label, control, then a hint or an error. Every control in a form sits in one.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Empty" htmlFor="ds-empty">
          <Input id="ds-empty" placeholder="e.g. Emergency fund" />
        </Field>
        <Field label="Filled" htmlFor="ds-filled">
          <Input id="ds-filled" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Optional with hint" htmlFor="ds-hint" optional hint="Shown under the amount in the list.">
          <Input id="ds-hint" placeholder="What it was for" />
        </Field>
        <Field label="Error" htmlFor="ds-error" error="Names are unique. There's already a category called Mercado.">
          <Input id="ds-error" defaultValue="Mercado" aria-invalid />
        </Field>
        <Field label="Disabled" htmlFor="ds-disabled">
          <Input id="ds-disabled" defaultValue="Can't change this" disabled />
        </Field>
        <Field label="With an aside" htmlFor="ds-aside" aside={<button type="button" className="text-xs font-medium text-primary hover:underline">All of it</button>}>
          <Input id="ds-aside" placeholder="Something on the right of the label" />
        </Field>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        <FieldGroupLabel>Group label</FieldGroupLabel>
        <FormReadout label="To save per month · 7 months left">
          <Money value={428_600} />
        </FormReadout>
      </div>
    </Panel>
  );
}

function MoneyAndDates() {
  const [big, setBig] = useState("1500000");
  const [small, setSmall] = useState("");
  const [date, setDate] = useState("");
  const [optional, setOptional] = useState("2026-12-15");
  return (
    <Panel title="Money and dates" note="MoneyInput holds digits and shows $ 1.500.000. DateField opens the browser's own picker; values stay YYYY-MM-DD.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="MoneyInput · lg" htmlFor="ds-money-lg">
          <MoneyInput id="ds-money-lg" size="lg" value={big} onValueChange={setBig} />
        </Field>
        <Field label="MoneyInput · md, empty" htmlFor="ds-money-md">
          <MoneyInput id="ds-money-md" value={small} onValueChange={setSmall} />
        </Field>
        <Field label="MoneyInput · invalid" htmlFor="ds-money-bad" error="More than the vault holds.">
          <MoneyInput id="ds-money-bad" value="9000000" onValueChange={() => {}} invalid />
        </Field>
        <Field label="MoneyInput · disabled" htmlFor="ds-money-off">
          <MoneyInput id="ds-money-off" value="350000" onValueChange={() => {}} disabled />
        </Field>
        <Field label="DateField · quick picks" htmlFor="ds-date">
          <DateField id="ds-date" value={date} onChange={setDate} quickPicks={["today", "yesterday"]} />
        </Field>
        <Field label="DateField · clearable" htmlFor="ds-date-opt" optional>
          <DateField id="ds-date-opt" value={optional} onChange={setOptional} clearable />
        </Field>
      </div>
    </Panel>
  );
}

function Choices() {
  const [category, setCategory] = useState<string | null>("c1");
  const [account, setAccount] = useState<string | null>(null);
  const [kind, setKind] = useState("expense");
  const [direction, setDirection] = useState("add");
  return (
    <Panel title="Choices" note="OptionSelect: native picker on touch screens, styled popup with a mouse. SegmentedControl: 2–4 options, neutral selection.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="OptionSelect · category icons">
          <OptionSelect ariaLabel="Category" value={category} onChange={setCategory} options={categorySelectOptions(CATEGORIES)} />
        </Field>
        <Field label="OptionSelect · dots, none option">
          <OptionSelect ariaLabel="Account" value={account} onChange={setAccount} noneLabel="None (notional)" options={ACCOUNTS} />
        </Field>
        <Field label="OptionSelect · placeholder, invalid" error="Pick a wallet.">
          <OptionSelect ariaLabel="Wallet" value={null} onChange={() => {}} placeholder="Pick a wallet…" options={ACCOUNTS} invalid />
        </Field>
        <Field label="OptionSelect · disabled" hint="A loan stays with the person it was lent to.">
          <OptionSelect ariaLabel="Lent to" value="a1" onChange={() => {}} options={ACCOUNTS} disabled />
        </Field>
        <Field label="SegmentedControl · md">
          <SegmentedControl
            ariaLabel="Kind"
            value={kind}
            onChange={setKind}
            options={[
              { value: "expense", label: "Expense" },
              { value: "income", label: "Income" },
              { value: "transfer", label: "Transfer" },
            ]}
          />
        </Field>
        <Field
          label="SegmentedControl · sm in an aside"
          htmlFor="ds-seg-amount"
          aside={
            <SegmentedControl
              ariaLabel="Add or deduct"
              size="sm"
              value={direction}
              onChange={setDirection}
              options={[
                { value: "add", label: "Add" },
                { value: "deduct", label: "Deduct" },
              ]}
            />
          }
        >
          <MoneyInput id="ds-seg-amount" value="" onValueChange={() => {}} />
        </Field>
      </div>
    </Panel>
  );
}

function ChecksColoursTags() {
  const [available, setAvailable] = useState(true);
  const [total, setTotal] = useState(false);
  const [colour, setColour] = useState<string | null>(PRESET_COLORS[0].value);
  const [noColour, setNoColour] = useState<string | null>(null);
  const [tags, setTags] = useState("uber, trip-cartagena, ");
  return (
    <Panel title="Checks, colours and tags">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col">
          <FieldGroupLabel>CheckField</FieldGroupLabel>
          <CheckField id="ds-check-1" label="Checked, with a hint" hint="Money you can use now, on Savings & Loans." checked={available} onChange={setAvailable} />
          <CheckField id="ds-check-2" label="Unchecked" checked={total} onChange={setTotal} />
          <CheckField id="ds-check-3" label="Disabled" checked onChange={() => {}} disabled />
        </div>
        <div className="flex flex-col gap-4">
          <Field label="ColorPicker">
            <ColorPicker value={colour} onChange={setColour} />
          </Field>
          <Field label="ColorPicker · allowNone" optional>
            <ColorPicker value={noColour} onChange={setNoColour} allowNone />
          </Field>
          <Field label="TagInput" htmlFor="ds-tags" optional>
            <TagInput id="ds-tags" value={tags} onChange={setTags} existing={["uber", "trip-cartagena", "gift", "work"]} />
          </Field>
        </div>
      </div>
    </Panel>
  );
}

function Buttons() {
  return (
    <Panel title="Buttons" note="One primary per footer, named for what it does. Delete enters as a ghost button; the confirm step uses destructive. Logs use the two-tap RowDeleteButton.">
      <div className="flex flex-wrap items-center gap-2">
        <Button>Record payment</Button>
        <Button variant="outline">Cancel</Button>
        <Button variant="ghost">
          <Plus aria-hidden />
          Add item
        </Button>
        <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          Delete
        </Button>
        <Button variant="destructive">Delete loan</Button>
        <Button disabled>Saving…</Button>
        <Button variant="ghost" size="icon" aria-label="Delete">
          <Trash2 />
        </Button>
        <span className="ml-2 flex items-center gap-2 text-xs text-muted-foreground">
          RowDeleteButton (tap twice)
          <RowDeleteButton label="Delete payment" onDelete={() => {}} />
        </span>
      </div>
    </Panel>
  );
}

function DialogDemo() {
  const [open, setOpen] = useState<"form" | "confirm" | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const missing = amount ? "" : "Add an amount to save.";
  return (
    <Panel title="FormDialog" note="A bottom sheet on phones. The footer hint says what's missing; the primary button waits for it. Delete is its own confirm view.">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setOpen("form")}>
          Open a form
        </Button>
        <Button variant="outline" onClick={() => setOpen("confirm")}>
          Open a delete confirm
        </Button>
      </div>
      <FormDialog
        open={open === "form"}
        onOpenChange={(o) => !o && setOpen(null)}
        title="Contribute to Emergency fund"
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(null);
        }}
        footer={
          <FormFooter hint={missing}>
            <Button type="button" variant="outline" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!!missing}>
              Record contribution
            </Button>
          </FormFooter>
        }
      >
        <Field label="Amount" htmlFor="ds-dlg-amount" hint={<>In the vault: <Money value={2_400_000} className="text-foreground" /></>}>
          <MoneyInput id="ds-dlg-amount" size="lg" value={amount} onValueChange={setAmount} autoFocus />
        </Field>
        <Field label="Date" htmlFor="ds-dlg-date">
          <DateField id="ds-dlg-date" value={date} onChange={setDate} quickPicks={["today", "yesterday"]} />
        </Field>
        <Field label="Notes" htmlFor="ds-dlg-notes" optional>
          <Input id="ds-dlg-notes" placeholder="e.g. Salary transfer" />
        </Field>
      </FormDialog>
      <FormDialog
        open={open === "confirm"}
        onOpenChange={(o) => !o && setOpen(null)}
        title="Delete Bancolombia?"
        footer={
          <FormFooter hint="It still has 2 loans. Delete or move those first.">
            <Button type="button" variant="outline" onClick={() => setOpen(null)} autoFocus>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled>
              Delete account
            </Button>
          </FormFooter>
        }
      >
        <p className="text-sm text-muted-foreground">
          Its 4 entries are deleted with it. An account that still has loans or transfers can&apos;t be deleted.
        </p>
      </FormDialog>
    </Panel>
  );
}

/** The form kit (components/ds/form) in its common states. */
export function FormsShowcase() {
  return (
    <>
      <div className="space-y-1 border-t border-border/60 pt-8">
        <h2 className="text-xl font-semibold">Forms</h2>
        <p className="text-sm text-muted-foreground">
          components/ds/form, plus the shared buttons. Every modal in the app is built from these. See DESIGN.md §7 Forms.
        </p>
      </div>
      <FieldStates />
      <MoneyAndDates />
      <Choices />
      <ChecksColoursTags />
      <Buttons />
      <DialogDemo />
    </>
  );
}
