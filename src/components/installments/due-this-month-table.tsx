"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PayButton } from "./pay-button";
import { PayAllButton } from "./pay-all-button";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WalletOption } from "@/components/shared/wallet-select";
import type { CategoryOption } from "@/lib/queries/expenses";
import type { DueThisMonth } from "@/lib/queries/installments";

type Props = {
  dueThisMonth: DueThisMonth[];
  totalObligation: number;
  walletOptions: WalletOption[];
  categories: CategoryOption[];
};

function SelectionToolbar({
  selectedItems,
  walletOptions,
  categories,
  onClear,
  className,
}: {
  selectedItems: DueThisMonth[];
  walletOptions: WalletOption[];
  categories: CategoryOption[];
  onClear: () => void;
  className?: string;
}) {
  return (
    <div className={cn("border-t border-border/60 bg-muted/20 px-4 py-2 items-center justify-between", className)}>
      <button
        onClick={onClear}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Clear selection
      </button>
      <PayAllButton
        items={selectedItems}
        walletOptions={walletOptions}
        categories={categories}
        onPaid={onClear}
      />
    </div>
  );
}

function DueThisMonthDesktopRow({
  due,
  isSelected,
  onToggle,
}: {
  due: DueThisMonth;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <TableRow
      onClick={onToggle}
      className={cn(
        "border-border cursor-pointer select-none transition-colors",
        isSelected
          ? "bg-primary/8 ring-1 ring-inset ring-primary/20 hover:bg-primary/10"
          : "hover:bg-muted/30 signal:odd:bg-foreground/[3%]"
      )}
    >
      <TableCell className="px-4 font-medium">{due.installment.description}</TableCell>
      <TableCell className="px-4 text-muted-foreground font-mono text-xs">
        {due.installmentNum} of {due.installment.numInstallments}
      </TableCell>
      <TableCell className="px-4 text-right font-mono">{formatCOP(due.amount)}</TableCell>
      <TableCell className="px-4 text-right" onClick={(e) => e.stopPropagation()}>
        <PayButton
          installmentId={due.installment.id}
          installmentNum={due.installmentNum}
          paymentId={due.payment?.id ?? null}
          paidAt={due.payment?.paidAt ?? null}
        />
      </TableCell>
    </TableRow>
  );
}

function DueThisMonthMobileRow({
  due,
  isSelected,
  onToggle,
}: {
  due: DueThisMonth;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        "flex flex-col gap-1.5 border-b border-border px-4 py-3 cursor-pointer select-none transition-colors last:border-0",
        isSelected ? "bg-primary/8 ring-1 ring-inset ring-primary/20" : "hover:bg-muted/30"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{due.installment.description}</span>
        <span className="shrink-0 font-mono text-sm">{formatCOP(due.amount)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          {due.installmentNum} of {due.installment.numInstallments}
        </span>
        <div onClick={(e) => e.stopPropagation()}>
          <PayButton
            installmentId={due.installment.id}
            installmentNum={due.installmentNum}
            paymentId={due.payment?.id ?? null}
            paidAt={due.payment?.paidAt ?? null}
          />
        </div>
      </div>
    </div>
  );
}

export function DueThisMonthTable({
  dueThisMonth,
  totalObligation,
  walletOptions,
  categories,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function rowKey(d: DueThisMonth) {
    return `${d.installment.id}-${d.installmentNum}`;
  }

  // Already-paid rows can't be selected for "pay all" — their slot is already
  // recorded, so a bulk-pay would insert a duplicate InstallmentPayment.
  // Unpaying is still available per-row via PayButton.
  function toggleRow(due: DueThisMonth) {
    if (due.payment !== null) return;
    const key = rowKey(due);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  const selectedItems = dueThisMonth.filter((d) => selected.has(rowKey(d)));
  const selectedTotal = selectedItems.reduce((s, d) => s + d.amount, 0);

  const paidCount = dueThisMonth.filter((d) => d.payment !== null).length;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Mobile: stacked rows — 4 columns (incl. a text pay button) don't fit
          375px without horizontal scroll. */}
      <div className="sm:hidden">
        {dueThisMonth.map((due) => {
          const key = rowKey(due);
          return (
            <DueThisMonthMobileRow
              key={key}
              due={due}
              isSelected={selected.has(key)}
              onToggle={() => toggleRow(due)}
            />
          );
        })}
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">
            {selected.size > 0 ? `${selected.size} selected` : `${paidCount} of ${dueThisMonth.length} paid`}
          </span>
          <span className="font-mono text-sm font-semibold">
            {selected.size > 0 ? formatCOP(selectedTotal) : formatCOP(totalObligation)}
          </span>
        </div>
        {selected.size > 0 && (
          <SelectionToolbar
            selectedItems={selectedItems}
            walletOptions={walletOptions}
            categories={categories}
            onClear={() => setSelected(new Set())}
            className="flex"
          />
        )}
      </div>

      <Table className="hidden sm:table">
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30 border-border">
            <TableHead className="px-4 text-xs uppercase tracking-wider text-muted-foreground">Item</TableHead>
            <TableHead className="px-4 text-xs uppercase tracking-wider text-muted-foreground">Installment</TableHead>
            <TableHead className="px-4 text-right text-xs uppercase tracking-wider text-muted-foreground">Amount</TableHead>
            <TableHead className="px-4 text-right text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dueThisMonth.map((due) => {
            const key = rowKey(due);
            return (
              <DueThisMonthDesktopRow
                key={key}
                due={due}
                isSelected={selected.has(key)}
                onToggle={() => toggleRow(due)}
              />
            );
          })}
        </TableBody>
        <TableFooter className="border-border">
          <TableRow className="border-border">
            <TableCell colSpan={2} className="px-4 text-xs font-medium text-muted-foreground">
              {selected.size > 0
                ? `${selected.size} selected`
                : `${paidCount} of ${dueThisMonth.length} paid`}
            </TableCell>
            <TableCell className="px-4 text-right font-mono font-semibold">
              {selected.size > 0 ? formatCOP(selectedTotal) : formatCOP(totalObligation)}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
      {selected.size > 0 && (
        <SelectionToolbar
          selectedItems={selectedItems}
          walletOptions={walletOptions}
          categories={categories}
          onClear={() => setSelected(new Set())}
          className="hidden sm:flex"
        />
      )}
    </div>
  );
}
