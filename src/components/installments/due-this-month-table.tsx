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
      <Table>
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
                    : "hover:bg-muted/30"
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
