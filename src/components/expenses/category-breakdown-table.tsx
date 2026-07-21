"use client";

import { useState, useTransition } from "react";
import { getCategoryTransactions, type CategoryTransaction } from "@/lib/actions/expenses";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BudgetProgressBar } from "./budget-progress-bar";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CategorySeverity, CategoryBudgetType } from "@/lib/queries/expenses";

type CategoryRow = {
  id: string;
  name: string;
  budgetType: CategoryBudgetType;
  spent: number;
  budget: number;
  control: number;
  percentUsed: number | null;
  note: string | null;
  severity: CategorySeverity;
};

type Props = {
  categoryBreakdown: CategoryRow[];
  month: number;
  year: number;
  titleSuffix?: string;
};

export function CategoryBreakdownTable({ categoryBreakdown, month, year, titleSuffix }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const [transactions, setTransactions] = useState<CategoryTransaction[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleRowClick(row: CategoryRow) {
    setSelectedName(row.name);
    setTransactions([]);
    setOpen(true);
    startTransition(async () => {
      const txns = await getCategoryTransactions(row.id, month, year);
      setTransactions(txns);
    });
  }

  return (
    <>
      <CategoryBreakdownCard
        categoryBreakdown={categoryBreakdown}
        titleSuffix={titleSuffix}
        onRowClick={handleRowClick}
      />
      <CategoryTransactionsDialog
        open={open}
        onOpenChange={setOpen}
        selectedName={selectedName}
        transactions={transactions}
        isPending={isPending}
      />
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CategoryBreakdownCard({
  categoryBreakdown,
  titleSuffix,
  onRowClick,
}: {
  categoryBreakdown: CategoryRow[];
  titleSuffix?: string;
  onRowClick: (row: CategoryRow) => void;
}) {
  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="px-5 py-4 border-b border-border/60">
        <CardTitle className="text-sm font-semibold">
          Spend by Category{titleSuffix ? ` — ${titleSuffix}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Mobile: stacked rows — avoids the horizontal scroll a 7-column table forces. */}
        <div className="sm:hidden">
          {categoryBreakdown.map((row) => (
            <CategoryMobileRow key={row.id} row={row} onClick={() => onRowClick(row)} />
          ))}
        </div>

        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="pl-5 text-xs uppercase tracking-wide text-muted-foreground">Category</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Type</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">Actual</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">Budget</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">Control</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground w-36">Progress</TableHead>
                <TableHead className="pr-5 text-xs uppercase tracking-wide text-muted-foreground">Severity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryBreakdown.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "border-border/40 transition-colors cursor-pointer",
                    rowBg(row.severity)
                  )}
                  onClick={() => onRowClick(row)}
                >
                  <TableCell className="pl-5 font-medium">{row.name}</TableCell>
                  <TableCell>
                    <TypePill type={row.budgetType} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {formatCOP(row.spent)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums text-muted-foreground">
                    {formatCOP(row.budget)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono text-sm tabular-nums",
                      row.control < 0 ? "text-destructive" : "text-success"
                    )}
                  >
                    {formatCOP(row.control)}
                  </TableCell>
                  <TableCell>
                    {row.percentUsed !== null ? (
                      <div className="flex items-center gap-2">
                        <BudgetProgressBar percent={row.percentUsed} className="flex-1" />
                        <span className="font-mono text-xs tabular-nums text-muted-foreground w-9 text-right shrink-0">
                          {row.percentUsed.toFixed(0)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={row.severity} />
                      {row.note && (
                        <span className="text-xs text-muted-foreground">{row.note}</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryTransactionsDialog({
  open,
  onOpenChange,
  selectedName,
  transactions,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedName: string;
  transactions: CategoryTransaction[];
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{selectedName}</DialogTitle>
        </DialogHeader>
        {isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No transactions this month.
          </p>
        ) : (
          <div className="overflow-auto max-h-[60vh] -mx-4">
            {/* Mobile: stacked rows — same rationale as the outer breakdown
                table above (avoids horizontal scroll a 5-column table forces). */}
            <div className="sm:hidden">
              {transactions.map((t) => (
                <CategoryTransactionMobileRow key={t.id} transaction={t} />
              ))}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="pl-4 text-xs uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                      Date
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                      Category
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                      Note
                    </TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">
                      Wallet
                    </TableHead>
                    <TableHead className="pr-4 text-right text-xs uppercase tracking-wide text-muted-foreground">
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id} className="border-border/40">
                      <TableCell className="pl-4 text-sm tabular-nums whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-sm">{t.mlCategoryName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                        {t.note ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.wallet}</TableCell>
                      <TableCell className="pr-4 text-right font-mono text-sm tabular-nums">
                        {formatCOP(Math.abs(t.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryMobileRow({ row, onClick }: { row: CategoryRow; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col gap-1.5 border-b border-border/40 px-4 py-3 text-left transition-colors last:border-0",
        rowBg(row.severity)
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium text-sm">{row.name}</span>
        <SeverityBadge severity={row.severity} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm tabular-nums">{formatCOP(row.spent)}</span>
        <span
          className={cn(
            "font-mono text-xs tabular-nums",
            row.control < 0 ? "text-destructive" : "text-success"
          )}
        >
          {row.control >= 0 ? "+" : ""}
          {formatCOP(row.control)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <TypePill type={row.budgetType} />
        <span className="truncate">of {formatCOP(row.budget)}</span>
        {row.note && <span className="truncate">· {row.note}</span>}
      </div>
      {row.percentUsed !== null && (
        <div className="flex items-center gap-2">
          <BudgetProgressBar percent={row.percentUsed} className="flex-1" />
          <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
            {row.percentUsed.toFixed(0)}%
          </span>
        </div>
      )}
    </button>
  );
}

// Mirrors transaction-row.tsx's TransactionDefaultRow priority: amount +
// category prominent on the top line, date/wallet secondary, note demoted to
// its own line below (truncated, same as the note column's desktop truncate).
function CategoryTransactionMobileRow({ transaction }: { transaction: CategoryTransaction }) {
  return (
    <div className="flex w-full flex-col gap-1 border-b border-border/40 px-4 py-2.5 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium">{transaction.mlCategoryName}</span>
        <span className="font-mono text-sm tabular-nums shrink-0">
          {formatCOP(Math.abs(transaction.amount))}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {new Date(transaction.date).toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
        <span className="truncate">{transaction.wallet}</span>
      </div>
      {transaction.note && (
        <p className="truncate text-xs text-muted-foreground">{transaction.note}</p>
      )}
    </div>
  );
}

function TypePill({ type }: { type: string }) {
  const styles: Record<string, string> = {
    FIXED:    "border-border/60 bg-muted text-muted-foreground",
    VARIABLE: "border-border/60 bg-muted text-muted-foreground",
    MIXED:    "border-amber-500/25 bg-amber-500/8 text-amber-600 dark:text-amber-400",
  };
  const labels: Record<string, string> = {
    FIXED: "Fixed", VARIABLE: "Variable", MIXED: "Mixed",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        styles[type] ?? styles.VARIABLE
      )}
    >
      {labels[type] ?? type}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: CategorySeverity }) {
  const styles: Record<CategorySeverity, string> = {
    OK:        "border-success/25 bg-success/10 text-success",
    Issue:     "border-warning/25 bg-warning/10 text-warning",
    Critical:  "border-destructive/25 bg-destructive/10 text-destructive",
    Unplanned: "border-warning/25 bg-warning/10 text-warning",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        styles[severity]
      )}
    >
      {severity}
    </span>
  );
}

function rowBg(severity: CategorySeverity) {
  switch (severity) {
    case "Critical":  return "bg-destructive/5 hover:bg-destructive/8";
    case "Issue":     return "bg-warning/5 hover:bg-warning/8";
    case "Unplanned": return "bg-warning/5 hover:bg-warning/8";
    default:          return "hover:bg-muted/30";
  }
}
