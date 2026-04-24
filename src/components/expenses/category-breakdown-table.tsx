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
};

export function CategoryBreakdownTable({ categoryBreakdown, month, year }: Props) {
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
      <Card className="overflow-hidden border-border/60">
        <CardHeader className="px-5 py-4 border-b border-border/60">
          <CardTitle className="text-sm font-semibold">Spend by Category</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="pl-5 text-xs uppercase tracking-wide text-muted-foreground">Category</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Type</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">Actual</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">Budget</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide text-muted-foreground">Control</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground w-36 hidden sm:table-cell">Progress</TableHead>
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
                  onClick={() => handleRowClick(row)}
                >
                  <TableCell className="pl-5 font-medium">{row.name}</TableCell>
                  <TableCell className="hidden sm:table-cell">
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
                  <TableCell className="hidden sm:table-cell">
                    {row.percentUsed !== null ? (
                      <div className="flex items-center gap-2">
                        <ProgressBar percent={row.percentUsed} className="flex-1" />
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
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
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
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TypePill({ type }: { type: string }) {
  const styles: Record<string, string> = {
    FIXED:    "border-blue-500/25 bg-blue-500/8 text-blue-600 dark:text-blue-400",
    VARIABLE: "border-violet-500/25 bg-violet-500/8 text-violet-600 dark:text-violet-400",
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

function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  const clamped = Math.min(percent, 100);
  const barColor =
    percent >= 100 ? "bg-destructive" :
    percent >= 80  ? "bg-warning" :
    "bg-success";
  return (
    <div className={cn("h-1.5 w-full rounded-full bg-muted/50", className)}>
      <div
        className={cn("h-1.5 rounded-full transition-all", barColor)}
        style={{ width: `${clamped}%` }}
      />
    </div>
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
