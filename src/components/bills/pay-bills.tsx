"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateField, Field, FormDialog, FormFooter, FormReadout, Money, MoneyInput, OptionSelect, StatusChip } from "@/components/ds";
import { CategoryIconTile } from "@/components/shared/category-option";
import type { WalletOption } from "@/components/shared/wallet-select";
import { payBills } from "@/lib/actions/bills";
import { billDifference, isDateInPeriod, paidChipLabel, payBillsMissingHint, type BillStatus } from "@/lib/bill-display";
import { amountToDigits, localISODate } from "@/lib/form-format";
import { MONTH_NAMES } from "@/lib/format";
import type { BillsForMonth } from "@/lib/queries/bills";
import { TONE_CLASSES, toneForBillDifference } from "@/lib/status";
import { cn } from "@/lib/utils";

type RowState = { checked: boolean; amount: string };

function initialRows(bills: BillStatus[]): Record<string, RowState> {
  return Object.fromEntries(bills.filter((b) => !b.paid).map((b) => [b.id, { checked: true, amount: amountToDigits(b.budget) }]));
}

function BillName({ bill }: { bill: BillStatus }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <CategoryIconTile category={bill.category} className="size-7 rounded-lg [&>svg]:size-3.5" />
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{bill.name}</span>
          {bill.budgetType === "VARIABLE" && <StatusChip tone="neutral">Variable</StatusChip>}
        </span>
        {/* Screen readers read the label as one name: "Internet, Services". */}
        <span className="sr-only">, </span>
        <span className="truncate text-xs text-muted-foreground">{bill.category.name}</span>
      </span>
    </span>
  );
}

function Difference({ amount, budget }: { amount: string; budget: number }) {
  const diff = billDifference(amount, budget);
  if (diff === null || diff === 0) return null;
  return (
    <span className="text-xs text-muted-foreground">
      <Money value={diff} signed tone={toneForBillDifference(diff)} /> vs budget (<Money value={budget} />)
    </span>
  );
}

function UnpaidRow({ bill, row, onChange, disabled }: { bill: BillStatus; row: RowState; onChange: (r: RowState) => void; disabled: boolean }) {
  const id = `bill-${bill.id}`;
  return (
    <li className={cn("grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-t border-border/60 py-3 sm:grid-cols-[auto_minmax(0,1fr)_11rem]", !row.checked && "opacity-60")}>
      {/* Wrapped: base-ui's Checkbox renders a hidden <input> sibling that would take a grid cell. */}
      <span className="flex pt-1.5">
        <Checkbox id={id} checked={row.checked} onCheckedChange={(v) => onChange({ ...row, checked: v === true })} disabled={disabled} />
      </span>
      <label htmlFor={id} className="cursor-pointer pt-0.5">
        <BillName bill={bill} />
      </label>
      <div className="col-start-2 flex flex-col gap-1 sm:col-start-3 sm:row-start-1 sm:items-end">
        <MoneyInput value={row.amount} onValueChange={(amount) => onChange({ ...row, amount })} aria-label={`${bill.name} amount`} disabled={disabled || !row.checked} />
        <Difference amount={row.amount} budget={bill.budget} />
      </div>
    </li>
  );
}

function PaidRow({ bill }: { bill: BillStatus }) {
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-border/60 py-3 opacity-60">
      <span className="flex">
        <Checkbox checked={false} disabled aria-label={`${bill.name} is paid`} />
      </span>
      <BillName bill={bill} />
      <span className="flex flex-col items-end gap-1">
        <StatusChip tone="positive">{paidChipLabel(bill.paidOn)}</StatusChip>
        <Money value={bill.paidAmount} className="text-xs" />
      </span>
    </li>
  );
}

function setAllChecked(rows: Record<string, RowState>, checked: boolean): Record<string, RowState> {
  return Object.fromEntries(Object.entries(rows).map(([id, r]) => [id, { ...r, checked }]));
}

/** Header of the bills list: ticks or unticks every unpaid bill (minus sign when only some are). */
function SelectAll({ checkedCount, total, onChange, disabled }: { checkedCount: number; total: number; onChange: (checked: boolean) => void; disabled: boolean }) {
  const all = total > 0 && checkedCount === total;
  return (
    <div className="flex items-center gap-3 border-t border-border/60">
      <label htmlFor="pay-bills-all" className="flex min-h-11 cursor-pointer items-center gap-3 has-disabled:cursor-not-allowed">
        <span className="flex">
          <Checkbox
            id="pay-bills-all"
            checked={all}
            indeterminate={checkedCount > 0 && !all}
            onCheckedChange={(v) => onChange(v === true)}
            disabled={disabled}
          />
        </span>
        <span className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">All bills</span>
      </label>
      <span className="ml-auto text-xs text-muted-foreground">
        {checkedCount} of {total} ticked
      </span>
    </div>
  );
}

function UnlinkedNote({ data }: { data: BillsForMonth }) {
  if (data.unlinked.length === 0) return null;
  return (
    <div className={cn("flex gap-2.5 rounded-lg px-3 py-2.5 text-xs leading-relaxed", TONE_CLASSES.info.soft)}>
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        {data.unlinked.map((u, i) => (
          <span key={u.categoryId}>
            {i > 0 && " "}
            {/* Explicit space: Next's client build dropped the one after <Money> here (this text has an &apos; entity; the tests' transform keeps it). */}
            {u.categoryName} already has <Money value={u.amount} />{" "}
            logged this month that isn&apos;t tied to a bill.
          </span>
        ))}{" "}
        Untick any bill it paid.
      </span>
    </div>
  );
}

function dateHint(date: string, data: BillsForMonth): React.ReactNode {
  if (date === "" || isDateInPeriod(date, data.startISO, data.endISO)) return undefined;
  return (
    <span className={TONE_CLASSES.caution.text}>
      This date is outside {MONTH_NAMES[data.month - 1]}&apos;s financial month, so these bills would still show as not paid.
    </span>
  );
}

/**
 * Pay this financial month's bills in one step (ADR-052). `children` is the
 * trigger's content — the Home insight card or the Analysis "Pay bills →"
 * link — wrapped in a button, so server components can pass it.
 */
export function PayBills({
  data,
  walletOptions,
  className,
  children,
}: {
  data: BillsForMonth;
  walletOptions: WalletOption[];
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [walletId, setWalletId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const unpaid = data.bills.filter((b) => !b.paid);
  const paid = data.bills.filter((b) => b.paid);
  const selected = unpaid.filter((b) => rows[b.id]?.checked);
  const total = selected.reduce((s, b) => s + (Number(rows[b.id].amount) || 0), 0);
  const missing = payBillsMissingHint(unpaid.map((b) => ({ name: b.name, ...(rows[b.id] ?? { checked: false, amount: "" }) })), walletId, date);

  function openDialog() {
    setRows(initialRows(data.bills));
    setDate(localISODate(new Date()));
    setError(null);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (missing || !walletId) return;
    setError(null);
    startTransition(async () => {
      const result = await payBills({
        walletId,
        date,
        bills: selected.map((b) => ({ budgetItemId: b.id, amount: Number(rows[b.id].amount) })),
      }).catch(() => ({ error: "Couldn't pay the bills. Try again." }));
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(`Paid ${selected.length} ${selected.length === 1 ? "bill" : "bills"}`);
      setOpen(false);
    });
  }

  const monthLabel = `${MONTH_NAMES[data.month - 1]} ${data.year}`;

  return (
    <>
      <button type="button" onClick={openDialog} className={className}>
        {children}
      </button>

      <FormDialog
        open={open}
        onOpenChange={(o) => !o && setOpen(false)}
        title="Pay bills"
        description={`${monthLabel} · ${unpaid.length === 0 ? "every bill is paid" : `${unpaid.length} not paid yet`}`}
        size="lg"
        onSubmit={handleSubmit}
        footer={
          <FormFooter hint={error ? <span className={TONE_CLASSES.danger.text}>{error}</span> : pending ? "" : missing}>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !!missing}>
              {pending ? "Paying…" : <>Pay <Money value={total} /></>}
            </Button>
          </FormFooter>
        }
      >
        <FormReadout label={`Total · ${selected.length} ${selected.length === 1 ? "bill" : "bills"}`}>
          <Money value={total} />
        </FormReadout>
        <UnlinkedNote data={data} />
        <div className="flex flex-col">
          <SelectAll
            checkedCount={selected.length}
            total={unpaid.length}
            onChange={(checked) => setRows((prev) => setAllChecked(prev, checked))}
            disabled={pending || unpaid.length === 0}
          />
          <ul className="flex flex-col">
            {unpaid.map((b) => (
              <UnpaidRow
                key={b.id}
                bill={b}
                row={rows[b.id] ?? { checked: false, amount: "" }}
                onChange={(r) => setRows((prev) => ({ ...prev, [b.id]: r }))}
                disabled={pending}
              />
            ))}
            {paid.map((b) => (
              <PaidRow key={b.id} bill={b} />
            ))}
          </ul>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Wallet">
            <OptionSelect ariaLabel="Wallet" value={walletId} onChange={setWalletId} options={walletOptions.map((w) => ({ value: w.id, label: w.name }))} />
          </Field>
          <Field label="Date" htmlFor="pay-bills-date" hint={dateHint(date, data)}>
            <DateField id="pay-bills-date" value={date} onChange={setDate} quickPicks={["today", "yesterday"]} required />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">One expense per bill, in its category, with the bill&apos;s name as the note.</p>
      </FormDialog>
    </>
  );
}
