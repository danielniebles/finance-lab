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
import { Meter, Money, SectionHeader, StatusChip } from "@/components/ds";
import { categoryStatus, groupCategories, isEmptyCategory, meterTone } from "@/lib/category-status";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CategoryStatusRow } from "@/lib/category-status";
import type { TagOption } from "@/lib/queries/tags";

// Falls back to the transaction's tags when there's no note — a bare "—"
// left the row with no identifying text at all once a note is missing.
function noteOrTagsLabel(note: string | null, tags: TagOption[]): string {
  if (note) return note;
  if (tags.length > 0) return tags.map((t) => `#${t.name}`).join(" ");
  return "—";
}

type CategoryRow = CategoryStatusRow;

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

// Grouped Fixed / Variable list with subtotals. Rows with no budget and no
// spend are hidden behind a toggle. One responsive grid row per category
// (no separate mobile markup): on narrow screens Budget/Left drop out and
// the meter + status wrap under the name.
function CategoryBreakdownCard({
  categoryBreakdown,
  titleSuffix,
  onRowClick,
}: {
  categoryBreakdown: CategoryRow[];
  titleSuffix?: string;
  onRowClick: (row: CategoryRow) => void;
}) {
  const [showEmpty, setShowEmpty] = useState(false);
  const emptyCount = categoryBreakdown.filter(isEmptyCategory).length;
  const visible = showEmpty ? categoryBreakdown : categoryBreakdown.filter((r) => !isEmptyCategory(r));
  const { fixed, variable } = groupCategories(visible);

  return (
    <section aria-label="Spending by category" className="flex flex-col gap-3">
      <SectionHeader
        title={`By category${titleSuffix ? ` · ${titleSuffix}` : ""}`}
        trailing={<span className="text-xs text-muted-foreground max-sm:hidden">Click a category to see its transactions</span>}
      />
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <div className={cn(ROW_GRID, "bg-muted/40 py-2.5 max-sm:hidden")}>
          <span className={HEAD}>Category</span>
          <span className={cn(HEAD, "text-right")}>Spent</span>
          <span className={cn(HEAD, "text-right")}>Budget</span>
          <span className={cn(HEAD, "text-right")}>Left</span>
          <span className={HEAD}>Used</span>
          <span className={HEAD}>Status</span>
        </div>
        <CategoryGroup title="Fixed" rows={fixed} onRowClick={onRowClick} />
        <CategoryGroup title="Variable" rows={variable} onRowClick={onRowClick} />
        {emptyCount > 0 && (
          <button
            type="button"
            onClick={() => setShowEmpty((v) => !v)}
            className="w-full border-t border-border/60 px-5 py-3 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {showEmpty
              ? "Hide empty categories"
              : `Show ${emptyCount} empty ${emptyCount === 1 ? "category" : "categories"} (no budget, nothing spent)`}
          </button>
        )}
      </div>
    </section>
  );
}

const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-5 py-3 sm:grid-cols-[minmax(140px,1.4fr)_repeat(3,minmax(96px,1fr))_minmax(110px,1fr)_120px]";
const HEAD = "font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground";

function CategoryGroup({
  title,
  rows,
  onRowClick,
}: {
  title: string;
  rows: CategoryRow[];
  onRowClick: (row: CategoryRow) => void;
}) {
  if (rows.length === 0) return null;
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  const budget = rows.reduce((s, r) => s + r.budget, 0);
  const left = budget - spent;
  return (
    <>
      <div className={cn(ROW_GRID, "border-t border-border/60 bg-muted/20 py-2.5")}>
        <span className="text-sm font-semibold">{title}</span>
        <Money value={spent} tone={left < 0 ? "danger" : undefined} className="text-right text-sm font-semibold" />
        <Money value={budget} className="text-right text-sm text-muted-foreground max-sm:hidden" />
        <Money value={left} tone={left < 0 ? "danger" : undefined} className="text-right text-sm text-muted-foreground max-sm:hidden" />
      </div>
      <ul>
        {rows.map((row) => (
          <CategoryRowItem key={row.id} row={row} onClick={() => onRowClick(row)} />
        ))}
      </ul>
    </>
  );
}

function CategoryRowItem({ row, onClick }: { row: CategoryRow; onClick: () => void }) {
  const status = categoryStatus(row);
  const noBudget = row.budget === 0;
  return (
    <li className="border-t border-border/40">
      <button type="button" onClick={onClick} className={cn(ROW_GRID, "w-full text-left text-sm transition-colors hover:bg-muted/30")}>
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{row.name}</span>
          {row.budgetType === "MIXED" && <span className="shrink-0 text-xs text-muted-foreground">Mixed</span>}
        </span>
        <Money value={row.spent} className={cn("text-right", row.spent === 0 && "text-muted-foreground")} />
        <span className="text-right text-muted-foreground max-sm:hidden">
          {noBudget ? "—" : <Money value={row.budget} />}
        </span>
        <span className="text-right max-sm:hidden">
          <Money value={row.control} tone={row.control < 0 ? "danger" : undefined} />
        </span>
        <span className="flex items-center gap-2 max-sm:col-span-1">
          <Meter
            label={`${row.name} budget used`}
            value={noBudget ? (row.spent > 0 ? 1 : 0) : row.percentUsed ?? 0}
            max={noBudget ? 1 : 100}
            tone={meterTone(row)}
            size="sm"
          />
          <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
            {row.percentUsed !== null ? `${row.percentUsed.toFixed(0)}%` : "—"}
          </span>
        </span>
        <span className="max-sm:justify-self-end">
          <StatusChip tone={status.tone}>{status.label}</StatusChip>
        </span>
      </button>
    </li>
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
                      <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                        {noteOrTagsLabel(t.note, t.tags)}
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

function CategoryTransactionMobileRow({ transaction }: { transaction: CategoryTransaction }) {
  return (
    <div className="flex w-full flex-col gap-1 border-b border-border/40 px-4 py-2.5 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium">
          {noteOrTagsLabel(transaction.note, transaction.tags)}
        </span>
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
    </div>
  );
}
