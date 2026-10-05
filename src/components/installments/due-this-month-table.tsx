"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Money, StatusChip } from "@/components/ds";
import { PayButton } from "./pay-button";
import { PayAllButton } from "./pay-all-button";
import { dueLabel, splitDues } from "@/lib/installment-display";
import { cn } from "@/lib/utils";
import type { WalletOption } from "@/components/shared/wallet-select";
import type { CategoryOption } from "@/lib/queries/expenses";
import type { DueThisMonth } from "@/lib/queries/installments";

type Props = {
  dueThisMonth: DueThisMonth[];
  totalObligation: number;
  /** cardId → payment due day, for each row's due chip. */
  cardDueDays: Map<string, number | null>;
  month: number;
  year: number;
  walletOptions: WalletOption[];
  categories: CategoryOption[];
};

function rowKey(d: DueThisMonth) {
  return `${d.installment.id}-${d.installmentNum}`;
}

function SelectionToolbar({
  selectedItems,
  walletOptions,
  categories,
  onClear,
}: {
  selectedItems: DueThisMonth[];
  walletOptions: WalletOption[];
  categories: CategoryOption[];
  onClear: () => void;
}) {
  const total = selectedItems.reduce((s, d) => s + d.amount, 0);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/30 px-4 py-2.5">
      <span className="flex items-center gap-3 text-xs text-muted-foreground">
        {selectedItems.length} selected · <Money value={total} className="font-semibold text-foreground" />
        <button onClick={onClear} className="hover:text-foreground">
          Clear
        </button>
      </span>
      <PayAllButton items={selectedItems} walletOptions={walletOptions} categories={categories} onPaid={onClear} />
    </div>
  );
}

function DueName({ due, paid }: { due: DueThisMonth; paid: boolean }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5 max-sm:basis-full">
      <span className={cn("truncate text-sm font-medium", paid && "text-muted-foreground")}>{due.installment.description}</span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {due.installment.cardColor && (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            // Card colour is user data.
            style={{ backgroundColor: due.installment.cardColor }}
          />
        )}
        {due.installment.cardName ?? "No card"} · {due.installmentNum} of {due.installment.numInstallments}
      </span>
    </span>
  );
}

// One row: [select] name / card · k of n … due chip · amount · pay.
// Same layout at every width; on phones the chip and amount wrap under the
// name. Clicking an unpaid row toggles it into the "pay selected" set.
function DueRow({
  due,
  dueDay,
  month,
  year,
  isSelected,
  onToggle,
}: {
  due: DueThisMonth;
  dueDay: number | null;
  month: number;
  year: number;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const paid = due.payment !== null;
  const chip = paid ? null : dueLabel(dueDay, month, year);
  return (
    <li
      onClick={paid ? undefined : onToggle}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/40 px-4 py-3 transition-colors first:border-t-0 sm:flex-nowrap",
        !paid && "cursor-pointer select-none",
        isSelected ? "bg-primary/10" : !paid && "hover:bg-muted/30",
      )}
    >
      <DueName due={due} paid={paid} />
      {chip && <StatusChip tone={chip.tone}>{chip.label}</StatusChip>}
      <Money value={due.amount} className={cn("ml-auto text-right text-sm sm:ml-0 sm:w-28", paid && "text-muted-foreground")} />
      <span onClick={(e) => e.stopPropagation()} className="shrink-0">
        <PayButton
          installmentId={due.installment.id}
          installmentNum={due.installmentNum}
          paymentId={due.payment?.id ?? null}
          paidAt={due.payment?.paidAt ?? null}
        />
      </span>
    </li>
  );
}

export function DueThisMonthTable({
  dueThisMonth,
  totalObligation,
  cardDueDays,
  month,
  year,
  walletOptions,
  categories,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPaid, setShowPaid] = useState(false);
  const { toPay, paid } = splitDues(dueThisMonth);
  const paidTotal = paid.reduce((s, d) => s + d.amount, 0);

  // Paid rows can't be selected for "pay all" — their slot is already
  // recorded, so a bulk-pay would insert a duplicate InstallmentPayment.
  function toggleRow(due: DueThisMonth) {
    if (due.payment !== null) return;
    const key = rowKey(due);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const selectedItems = dueThisMonth.filter((d) => selected.has(rowKey(d)));
  const renderRow = (d: DueThisMonth) => (
    <DueRow
      key={rowKey(d)}
      due={d}
      dueDay={d.installment.cardId ? cardDueDays.get(d.installment.cardId) ?? null : null}
      month={month}
      year={year}
      isSelected={selected.has(rowKey(d))}
      onToggle={() => toggleRow(d)}
    />
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      {toPay.length > 0 ? (
        <ul>{toPay.map(renderRow)}</ul>
      ) : (
        <p className="px-4 py-5 text-sm text-muted-foreground">Everything due this month is paid.</p>
      )}

      {selectedItems.length > 0 && (
        <SelectionToolbar
          selectedItems={selectedItems}
          walletOptions={walletOptions}
          categories={categories}
          onClear={() => setSelected(new Set())}
        />
      )}

      {paid.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={showPaid}
            onClick={() => setShowPaid((v) => !v)}
            className="flex w-full items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <span>Paid this month · {paid.length}</span>
            <span className="flex items-center gap-2">
              <Money value={paidTotal} tone="positive" />
              <ChevronDown className={cn("size-4 transition-transform", showPaid && "rotate-180")} aria-hidden />
            </span>
          </button>
          {showPaid && <ul className="border-t border-border/40">{paid.map(renderRow)}</ul>}
        </>
      )}

      <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
        <span>
          {paid.length} of {dueThisMonth.length} paid
        </span>
        <span>
          Month total <Money value={totalObligation} className="font-semibold text-foreground" />
        </span>
      </div>
    </div>
  );
}
