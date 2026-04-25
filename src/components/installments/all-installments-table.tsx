"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InstallmentActions } from "./installment-actions";
import { formatCOP } from "@/lib/format";
import type { InstallmentRow } from "@/lib/queries/installments";

type Props = {
  installments: InstallmentRow[];
};

function StatusBadge({ status }: { status: "Active" | "Finished" }) {
  if (status === "Finished") {
    return (
      <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
        Finished
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
      Active
    </span>
  );
}

function ProgressBar({ paid, total }: { paid: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-muted-foreground">
        {paid}/{total}
      </span>
    </div>
  );
}

export function AllInstallmentsTable({ installments }: Props) {
  const [showFinished, setShowFinished] = useState(false);

  const finishedCount = installments.filter((i) => i.status === "Finished").length;
  const visible = showFinished
    ? installments
    : installments.filter((i) => i.status === "Active");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          All installments
        </h2>
        <div className="flex items-center gap-3">
          {finishedCount > 0 && (
            <button
              onClick={() => setShowFinished((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showFinished ? "Hide finished" : `Show finished (${finishedCount})`}
            </button>
          )}
          <InstallmentActions mode="add-button" />
        </div>
      </div>

      {installments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No installments yet. Add one above.</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active installments.{" "}
          <button
            onClick={() => setShowFinished(true)}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Show finished ({finishedCount})
          </button>
        </p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30 border-border">
                <TableHead className="px-4 text-xs uppercase tracking-wider text-muted-foreground">Item</TableHead>
                <TableHead className="px-4 text-right text-xs uppercase tracking-wider text-muted-foreground">Total</TableHead>
                <TableHead className="px-4 text-right text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Monthly</TableHead>
                <TableHead className="px-4 text-right text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Rate</TableHead>
                <TableHead className="px-4 text-center text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Progress</TableHead>
                <TableHead className="px-4 text-right text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Ends</TableHead>
                <TableHead className="px-4 text-right text-xs uppercase tracking-wider text-muted-foreground">Remaining</TableHead>
                <TableHead className="px-4 text-center text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((inst) => (
                <TableRow key={inst.id} className="border-border">
                  <TableCell className="px-4">
                    <div className="font-medium">{inst.description}</div>
                    {inst.notes && (
                      <div className="text-xs text-muted-foreground">{inst.notes}</div>
                    )}
                  </TableCell>
                  <TableCell className="px-4 text-right font-mono text-sm">
                    {formatCOP(inst.totalAmount)}
                  </TableCell>
                  <TableCell className="px-4 text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
                    {formatCOP(inst.monthlyAmount)}
                    {inst.monthlyInterestRate != null && (
                      <span className="ml-1 text-muted-foreground/50 text-xs">+int</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 text-right font-mono text-sm text-muted-foreground hidden md:table-cell">
                    {inst.monthlyInterestRate != null
                      ? `${inst.monthlyInterestRate}% m.v.`
                      : "—"}
                  </TableCell>
                  <TableCell className="px-4 hidden sm:table-cell">
                    <div className="flex justify-center">
                      <ProgressBar paid={inst.installmentsPaid} total={inst.numInstallments} />
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-right font-mono text-xs text-muted-foreground hidden md:table-cell whitespace-nowrap">
                    {inst.endDate.toLocaleDateString("es-CO", {
                      month: "short",
                      year: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="px-4 text-right font-mono text-sm">
                    {inst.remaining > 0 ? formatCOP(inst.remaining) : "—"}
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex justify-center">
                      <StatusBadge status={inst.status} />
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <InstallmentActions mode="row-actions" installment={inst} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
