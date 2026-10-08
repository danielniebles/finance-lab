"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DateField, Field, FormDialog, FormFooter, FormReadout, Money, OptionSelect } from "@/components/ds";
import { categorySelectOptions } from "@/components/shared/category-option";
import type { WalletOption } from "@/components/shared/wallet-select";
import { localISODate } from "@/lib/form-format";
import { payAllGroup } from "@/lib/installment-display";
import { payInstallmentsBulk } from "@/lib/actions/installments";
import type { CategoryOption } from "@/lib/queries/expenses";
import type { DueThisMonth } from "@/lib/queries/installments";

// Prefilled note listing what's being paid — editable before confirming, same
// "generate a sane default, let the user override" pattern as add-transaction-button.
function defaultNote(items: DueThisMonth[]): string {
  return items
    .map(
      (d) =>
        `${d.installment.description} (cuota ${d.installmentNum}/${d.installment.numInstallments})`,
    )
    .join(", ");
}

function missingHint(appCategoryId: string | null, walletId: string | null): string {
  if (!appCategoryId && !walletId) return "Pick a category and a wallet.";
  if (!appCategoryId) return "Pick a category.";
  return walletId ? "" : "Pick a wallet.";
}

function paidMessage(items: DueThisMonth[], loanCreated: boolean): string {
  const paid = `Paid ${items.length} ${items.length === 1 ? "installment" : "installments"}`;
  return loanCreated ? `${paid} — loan recorded for ${items[0]?.installment.debtorName ?? "the debtor"}` : paid;
}

type Props = {
  items: DueThisMonth[];
  walletOptions: WalletOption[];
  categories: CategoryOption[];
  onPaid: () => void;
};

export function PayAllButton({ items, walletOptions, categories, onPaid }: Props) {
  const [open, setOpen] = useState(false);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [appCategoryId, setAppCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(() => localISODate(new Date()));
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const total = useMemo(() => items.reduce((s, d) => s + d.amount, 0), [items]);
  // One payment = one transaction: own installments and each person's are paid separately (ADR-060).
  const mixed = useMemo(() => payAllGroup(items.map((d) => d.installment)).kind === "mixed", [items]);
  const canSubmit = !!walletId && !!appCategoryId && date !== "" && items.length > 0;
  const missing = missingHint(appCategoryId, walletId);

  function openDialog() {
    setNote(defaultNote(items));
    setDate(localISODate(new Date()));
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !walletId || !appCategoryId) return;
    const walletName = walletOptions.find((w) => w.id === walletId)?.name ?? "";
    const slots = items.map((d) => ({
      installmentId: d.installment.id,
      installmentNum: d.installmentNum,
    }));
    startTransition(async () => {
      try {
        const result = await payInstallmentsBulk(slots, {
          walletId,
          wallet: walletName,
          appCategoryId,
          date: new Date(date + "T12:00:00"),
          note,
        });
        toast.success(paidMessage(items, result.loansCreated > 0));
        setOpen(false);
        onPaid();
      } catch {
        toast.error("Couldn't pay selected installments");
      }
    });
  }

  return (
    <>
      {mixed && <span className="text-xs text-muted-foreground">Pay yours and each person&apos;s separately</span>}
      <Button size="sm" onClick={openDialog} disabled={mixed} className="h-7 gap-1.5 text-xs">
        Pay all ({items.length})
      </Button>

      <FormDialog
        open={open}
        onOpenChange={(o) => !o && setOpen(false)}
        title={`Pay ${items.length} ${items.length === 1 ? "installment" : "installments"}`}
        onSubmit={handleSubmit}
        footer={
          <FormFooter hint={pending ? "" : missing}>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !canSubmit}>
              Pay <Money value={total} />
            </Button>
          </FormFooter>
        }
      >
        <FormReadout label={`Total · ${items.length} ${items.length === 1 ? "cuota" : "cuotas"}`}>
          <Money value={total} />
        </FormReadout>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <OptionSelect ariaLabel="Category" value={appCategoryId} onChange={setAppCategoryId} options={categorySelectOptions(categories.filter((c) => !c.isTransfer))} />
          </Field>
          <Field label="Wallet">
            <OptionSelect ariaLabel="Wallet" value={walletId} onChange={setWalletId} options={walletOptions.map((w) => ({ value: w.id, label: w.name }))} />
          </Field>
        </div>
        <Field label="Date" htmlFor="pay-all-date">
          <DateField id="pay-all-date" value={date} onChange={setDate} quickPicks={["today", "yesterday"]} required />
        </Field>
        <Field label="Note" htmlFor="pay-all-note" hint="Prefilled with what's being paid; edit it if you like.">
          <textarea
            id="pay-all-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
          />
        </Field>
      </FormDialog>
    </>
  );
}
