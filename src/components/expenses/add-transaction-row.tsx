"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Plus, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DateField,
  Field,
  FormDialog,
  FormFooter,
  MoneyInput,
  OptionSelect,
  SegmentedControl,
  TagInput,
  type SegmentOption,
} from "@/components/ds";
import { formatCOP } from "@/lib/format";
import { amountToDigits, localISODate } from "@/lib/form-format";
import {
  createTransaction,
  createWalletTransfer,
  suggestTransactionFields,
  setTransactionTags,
} from "@/lib/actions/transactions";
import { WalletSelect } from "@/components/shared/wallet-select";
import { categorySelectOptions } from "@/components/shared/category-option";
import { parseTagNames } from "@/lib/tag-utils";
import type { CategoryOption } from "@/lib/queries/expenses";
import type { TransactionSuggestion } from "@/lib/actions/transactions";
import type { TagOption } from "@/lib/queries/tags";

type TxnType = "expense" | "income" | "transfer";

type FormValues = {
  type: TxnType;
  amount: string;
  date: string;
  appCategoryId: string;
  walletId: string;
  // Transfer-only: the destination wallet. walletId doubles as the source
  // ("From") wallet in transfer mode — no separate fromWalletId field needed,
  // since it's the same "which wallet is this dialog scoped to" concept the
  // Expense/Income tabs already use.
  toWalletId: string;
  note: string;
  tagNames: string;
};

// Open-time / post-cancel defaults. `walletId` is the one field that carries
// state across open/close cycles within the session (see AddTransactionRow's
// `lastWallet`) — every other field resets clean.
function defaultValues(lastWallet: string): FormValues {
  return {
    type: "expense",
    amount: "",
    date: localISODate(new Date()),
    appCategoryId: "",
    walletId: lastWallet,
    toWalletId: "",
    note: "",
    tagNames: "",
  };
}

// Pure so it's easy to reason about / test independent of the component —
// candidate for extraction into a unit test if this logic grows.
function canSubmit(values: FormValues): boolean {
  const amount = parseFloat(values.amount);
  const validAmount = !Number.isNaN(amount) && amount !== 0;
  const validDate =
    values.date !== "" && !Number.isNaN(new Date(values.date + "T12:00:00").getTime());
  if (values.type === "transfer") {
    return (
      validAmount &&
      validDate &&
      values.walletId !== "" &&
      values.toWalletId !== "" &&
      values.walletId !== values.toWalletId
    );
  }
  return validAmount && validDate && values.appCategoryId !== "" && values.walletId !== "";
}

/** Footer hint naming what's still missing ("" when the form can be saved). */
export function missingFieldsHint(values: FormValues): string {
  const missing: string[] = [];
  const amount = parseFloat(values.amount);
  if (Number.isNaN(amount) || amount === 0) missing.push("an amount");
  if (values.type === "transfer") {
    if (!values.walletId || !values.toWalletId) missing.push("both wallets");
  } else {
    if (!values.appCategoryId) missing.push("a category");
    if (!values.walletId) missing.push("a wallet");
  }
  if (missing.length === 0) return "";
  const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}`;
  return `Add ${list} to save.`;
}

const TYPE_OPTIONS: SegmentOption<TxnType>[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer", icon: <ArrowLeftRight aria-hidden /> },
];

const SUBMIT_LABEL: Record<TxnType, string> = {
  expense: "Add expense",
  income: "Add income",
  transfer: "Add transfer",
};

// Amount is always typed as a positive magnitude; the sign is applied here
// from the TypeToggle selection at submit time.
function signedAmount(type: TxnType, rawAmount: string): number {
  const magnitude = Math.abs(parseFloat(rawAmount));
  return type === "expense" ? -magnitude : magnitude;
}

// Turns a suggestion into a form patch: category + wallet always, plus
// whichever complementary field the suggestion carries (a note-sourced
// suggestion's signed amount gets split back into type + magnitude to match
// how the amount input stores it; an amount-sourced suggestion's note is
// copied as-is).
function suggestionToPatch(suggestion: TransactionSuggestion): Partial<FormValues> {
  const patch: Partial<FormValues> = {
    appCategoryId: suggestion.appCategoryId,
    walletId: suggestion.walletId,
  };
  if (suggestion.amount !== undefined) {
    patch.type = suggestion.amount < 0 ? "expense" : "income";
    patch.amount = amountToDigits(suggestion.amount);
  }
  if (suggestion.note !== undefined) {
    patch.note = suggestion.note;
  }
  return patch;
}

const SUGGESTION_DEBOUNCE_MS = 500;

// Debounced lookup against past transactions as the user types note/amount —
// server-side matching lives in suggestTransactionFields (note match first,
// falling back to an amount-tolerance match). Returns a suggestion the
// caller renders as a dismissible chip; it never auto-applies itself, since
// silently overwriting a field the user hasn't touched yet is the failure
// mode to avoid (see conversation that led to this feature).
function useTransactionSuggestion(note: string, amount: string, type: TxnType) {
  const [suggestion, setSuggestion] = useState<TransactionSuggestion | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const parsedAmount = parseFloat(amount);
      const hasAmount = !Number.isNaN(parsedAmount) && parsedAmount !== 0;
      const trimmedNote = note.trim();
      if (!hasAmount && !trimmedNote) {
        setSuggestion(null);
        return;
      }
      suggestTransactionFields({
        amount: hasAmount ? signedAmount(type, amount) : undefined,
        note: trimmedNote || undefined,
      }).then((result) => {
        setSuggestion(result);
        setDismissed(false);
      });
    }, SUGGESTION_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [note, amount, type]);

  return { suggestion, dismissed, dismiss: () => setDismissed(true) };
}

type Props = {
  categories: CategoryOption[];
  walletOptions: { id: string; name: string }[];
  tags: TagOption[];
  // The ledger's current ?walletId= filter, if any — takes priority over
  // lastWallet so opening the dialog from a wallet-scoped view defaults to
  // that wallet rather than whatever was last used this session.
  activeWalletId?: string;
};

// Renders a trigger button that opens a modal creation form — kept out of
// LedgerControls' filter-requery dimming since it's a Dialog now (always
// interactive regardless of what's happening in the list behind it). Modal
// instead of the old inline-expanding row: expanding in place pushed the
// list down and stole scroll position, and its autoFocus fired every time
// the row expanded even when it wasn't the user's intent to type immediately.
export function AddTransactionRow({ categories, walletOptions, tags, activeWalletId }: Props) {
  const [open, setOpen] = useState(false);
  const [lastWallet, setLastWallet] = useState("");
  const [values, setValues] = useState<FormValues>(() => defaultValues(activeWalletId ?? ""));
  const [pending, startTransition] = useTransition();
  const amountInputRef = useRef<HTMLInputElement>(null);

  function openDialog() {
    setValues(defaultValues(activeWalletId || lastWallet));
    setOpen(true);
  }

  function closeDialog() {
    setValues(defaultValues(activeWalletId || lastWallet));
    setOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit(values)) return;
    const submittedWalletId = values.walletId;
    const tagNames = parseTagNames(values.tagNames);
    const note = values.note.trim() === "" ? undefined : values.note;

    if (values.type === "transfer") {
      startTransition(async () => {
        try {
          const { outgoing, incoming } = await createWalletTransfer({
            amount: Math.abs(parseFloat(values.amount)),
            date: new Date(values.date + "T12:00:00"),
            fromWalletId: submittedWalletId,
            toWalletId: values.toWalletId,
            note,
          });
          if (tagNames.length > 0) {
            await Promise.all([
              setTransactionTags(outgoing.id, tagNames),
              setTransactionTags(incoming.id, tagNames),
            ]);
          }
          toast.success("Transfer added");
          setLastWallet(submittedWalletId);
          setValues((v) => ({ ...v, amount: "", note: "", tagNames: "" }));
          amountInputRef.current?.focus();
        } catch {
          toast.error("Couldn't add transfer");
        }
      });
      return;
    }

    const submittedWalletName = walletOptions.find((w) => w.id === submittedWalletId)?.name ?? "";
    startTransition(async () => {
      try {
        const created = await createTransaction({
          amount: signedAmount(values.type, values.amount),
          date: new Date(values.date + "T12:00:00"),
          appCategoryId: values.appCategoryId,
          wallet: submittedWalletName,
          walletId: submittedWalletId,
          note,
        });
        if (tagNames.length > 0) await setTransactionTags(created.id, tagNames);
        toast.success("Transaction added");
        setLastWallet(submittedWalletId);
        // Speed optimization for batch entry: only clear amount/note/tags,
        // keep type/date/appCategoryId/walletId as-is and stay open.
        setValues((v) => ({ ...v, amount: "", note: "", tagNames: "" }));
        amountInputRef.current?.focus();
      } catch {
        toast.error("Couldn't add transaction");
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={openDialog}
        className="h-auto w-full justify-start gap-1.5 rounded-xl border border-dashed border-border/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <Plus className="size-4" />
        Add transaction
      </Button>

      <CreateForm
        open={open}
        values={values}
        categories={categories}
        walletOptions={walletOptions}
        tags={tags}
        pending={pending}
        amountInputRef={amountInputRef}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        onSubmit={handleSubmit}
        onCancel={closeDialog}
      />
    </>
  );
}

function CreateForm({
  open,
  values,
  categories,
  walletOptions,
  tags,
  pending,
  amountInputRef,
  onChange,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  values: FormValues;
  categories: CategoryOption[];
  walletOptions: { id: string; name: string }[];
  tags: TagOption[];
  pending: boolean;
  amountInputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (patch: Partial<FormValues>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  const idPrefix = useId();
  const submitDisabled = pending || !canSubmit(values);
  const { suggestion, dismissed, dismiss } = useTransactionSuggestion(values.note, values.amount, values.type);
  const showSuggestion =
    values.type !== "transfer" &&
    suggestion !== null &&
    !dismissed &&
    (values.appCategoryId !== suggestion.appCategoryId || values.walletId !== suggestion.walletId);

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onCancel()}
      title="Add transaction"
      onSubmit={onSubmit}
      footer={
        <FormFooter hint={pending ? "" : missingFieldsHint(values)}>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitDisabled}>
            {SUBMIT_LABEL[values.type]}
          </Button>
        </FormFooter>
      }
    >
      <SegmentedControl ariaLabel="Transaction type" value={values.type} onChange={(type) => onChange({ type })} options={TYPE_OPTIONS} />

      <Field label="Amount" htmlFor={`${idPrefix}-amount`}>
        <MoneyInput
          id={`${idPrefix}-amount`}
          inputRef={amountInputRef}
          size="lg"
          value={values.amount}
          onValueChange={(amount) => onChange({ amount })}
          autoFocus
          required
        />
      </Field>

      {showSuggestion && (
        <SuggestionBanner
          suggestion={suggestion}
          onApply={() => onChange(suggestionToPatch(suggestion))}
          onDismiss={dismiss}
        />
      )}

      <CategoryOrTransferFields values={values} categories={categories} walletOptions={walletOptions} onChange={onChange} />

      <Field label="Date" htmlFor={`${idPrefix}-date`}>
        <DateField
          id={`${idPrefix}-date`}
          value={values.date}
          onChange={(date) => onChange({ date })}
          quickPicks={["today", "yesterday"]}
          required
        />
      </Field>

      <Field label="Note" htmlFor={`${idPrefix}-note`} optional>
        <Input
          id={`${idPrefix}-note`}
          value={values.note}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder={values.type === "transfer" ? "Defaults to “Transfer to/from …”" : "What was it for?"}
        />
      </Field>

      <Field label="Tags" htmlFor={`${idPrefix}-tags`} optional>
        <TagInput
          id={`${idPrefix}-tags`}
          value={values.tagNames}
          existing={tags.map((t) => t.name)}
          onChange={(tagNames) => onChange({ tagNames })}
        />
      </Field>
    </FormDialog>
  );
}

// Second field row of CreateForm — a Category+Wallet pair for Expense/Income,
// or a From+To wallet pair for Transfer. Split out purely to keep CreateForm
// under the quality gate's max-lines-per-function; no state of its own.
function CategoryOrTransferFields({
  values,
  categories,
  walletOptions,
  onChange,
}: {
  values: FormValues;
  categories: CategoryOption[];
  walletOptions: { id: string; name: string }[];
  onChange: (patch: Partial<FormValues>) => void;
}) {
  if (values.type === "transfer") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          <WalletSelect
            value={values.walletId}
            options={walletOptions}
            onChange={(v) =>
              onChange({ walletId: v, toWalletId: v === values.toWalletId ? "" : values.toWalletId })
            }
            ariaLabel="From wallet"
            placeholder="Choose…"
          />
        </Field>
        <Field label="To">
          <WalletSelect
            value={values.toWalletId}
            options={walletOptions.filter((w) => w.id !== values.walletId)}
            onChange={(v) => onChange({ toWalletId: v })}
            ariaLabel="To wallet"
            placeholder="Choose…"
          />
        </Field>
      </div>
    );
  }
  // Outgoing/Incoming Transfer are only ever auto-assigned by
  // createWalletTransfer (the Transfer tab) — never a manual pick here.
  const selectable = categories.filter((c) => !c.isTransfer);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Category">
        <OptionSelect
          ariaLabel="Category"
          value={values.appCategoryId || null}
          onChange={(v) => onChange({ appCategoryId: v ?? "" })}
          options={categorySelectOptions(selectable)}
        />
      </Field>
      <Field label="Wallet">
        <WalletSelect value={values.walletId} options={walletOptions} onChange={(v) => onChange({ walletId: v })} placeholder="Choose…" />
      </Field>
    </div>
  );
}

function SuggestionBanner({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: TransactionSuggestion;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const matchLabel = suggestion.source === "note" ? "note" : "amount";
  const complement =
    suggestion.amount !== undefined
      ? formatCOP(suggestion.amount)
      : suggestion.note !== undefined
      ? `“${suggestion.note}”`
      : null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2">
      <span className="text-xs text-muted-foreground">
        Suggest <span className="font-medium text-foreground">{suggestion.categoryName}</span> ·{" "}
        <span className="font-medium text-foreground">{suggestion.walletName}</span>
        {complement && (
          <>
            {" · "}
            <span className="font-medium text-foreground">{complement}</span>
          </>
        )}{" "}
        — {suggestion.sampleCount} similar {matchLabel} match{suggestion.sampleCount > 1 ? "es" : ""}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={onApply}>
          Apply
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
