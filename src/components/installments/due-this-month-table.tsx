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
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DueThisMonth } from "@/lib/queries/installments";

type Props = {
  dueThisMonth: DueThisMonth[];
  totalObligation: number;
};

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

export function DueThisMonthTable({ dueThisMonth, totalObligation }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function rowKey(d: DueThisMonth) {
    return `${d.installment.id}-${d.installmentNum}`;
  }

  function toggleRow(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  const selectedTotal = dueThisMonth
    .filter((d) => selected.has(rowKey(d)))
    .reduce((s, d) => s + d.amount, 0);

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
              onToggle={() => toggleRow(key)}
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
            const isSelected = selected.has(key);
            return (
              <TableRow
                key={key}
                onClick={() => toggleRow(key)}
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
                <TableCell
                  className="px-4 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <PayButton
                    installmentId={due.installment.id}
                    installmentNum={due.installmentNum}
                    paymentId={due.payment?.id ?? null}
                    paidAt={due.payment?.paidAt ?? null}
                  />
                </TableCell>
              </TableRow>
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
        <div className="border-t border-border/60 bg-muted/20 px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Click a row again to deselect
          </span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}
