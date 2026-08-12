"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { buildLedgerUrl } from "@/components/expenses/ledger-controls";
import type { CategorySummaryRow, LedgerGroupBy, LedgerFilters } from "@/lib/queries/transactions";

type Props = {
  rows: CategorySummaryRow[];
  month: number;
  year: number;
  groupBy: LedgerGroupBy;
  filters: LedgerFilters;
};

// Quick filter: clicking a row filters the list below to that category —
// same CategorySelect re-query LedgerControls already drives, just a second
// entry point onto it. Clicking the already-active row clears the filter.
//
// Collapsed by default: this panel used to always render open, pushing the
// actual transaction list (the thing people open the Ledger tab to see)
// further down the page — especially painful on mobile with many categories.
export function CategorySummaryPanel({ rows, month, year, groupBy, filters }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (rows.length === 0) return null;

  function handleRowClick(name: string) {
    const nextCategory = filters.category === name ? "" : name;
    startTransition(() => {
      router.push(buildLedgerUrl(month, year, groupBy, filters, { category: nextCategory }));
    });
  }

  return (
    <Collapsible defaultOpen={false} className="rounded-xl border border-border/60 bg-card">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Categories <span className="normal-case text-muted-foreground/60">({rows.length})</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          "space-y-1 px-4 pb-4 transition-opacity",
          isPending && "opacity-50 pointer-events-none"
        )}
      >
        {rows.map((row) => {
          const active = filters.category === row.name;
          return (
            <button
              key={row.name}
              type="button"
              aria-pressed={active}
              onClick={() => handleRowClick(row.name)}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors",
                active ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/50 hover:bg-muted"
              )}
            >
              <span className="text-sm truncate">{row.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {row.count} txn{row.count !== 1 ? "s" : ""}
                </span>
                <span
                  className={cn(
                    "font-mono text-sm tabular-nums",
                    row.total < 0 ? "text-destructive" : "text-success"
                  )}
                >
                  {row.total < 0 ? "-" : ""}
                  {formatCOP(Math.abs(row.total))}
                </span>
              </div>
            </button>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
