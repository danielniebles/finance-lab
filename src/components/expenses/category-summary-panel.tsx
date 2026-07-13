"use client";

import { ChevronDown } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import type { CategorySummaryRow } from "@/lib/queries/transactions";

// Informational only — clicking a row here does NOT filter the list below
// (CategorySelect already owns that action; a second hidden trigger for the
// same re-query would be a duplicate control, per the design spec).
//
// Collapsed by default: this panel used to always render open, pushing the
// actual transaction list (the thing people open the Ledger tab to see)
// further down the page — especially painful on mobile with many categories.
export function CategorySummaryPanel({ rows }: { rows: CategorySummaryRow[] }) {
  if (rows.length === 0) return null;

  return (
    <Collapsible defaultOpen={false} className="rounded-xl border border-border/60 bg-card">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Categories <span className="normal-case text-muted-foreground/60">({rows.length})</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 px-4 pb-4">
        {rows.map((row) => (
          <div
            key={row.name}
            className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2"
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
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
