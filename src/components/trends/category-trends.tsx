"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Meter, Money, StatusChip } from "@/components/ds";
import { TONE_CLASSES, toneForBudgetUsed } from "@/lib/status";
import type { CategoryRowStats } from "@/lib/trend-utils";
import { cn } from "@/lib/utils";

export const TOP_CATEGORIES = 10;

export type CategoryColumns = {
  /** "6-mo avg" */
  avgLabel: string;
  /** Last complete month, "Sep". */
  lastLabel: string | null;
  /** Running month, "October so far". */
  currentLabel: string | null;
};

const GRID = "sm:grid sm:grid-cols-[minmax(9rem,1.4fr)_repeat(3,minmax(6.5rem,1fr))_minmax(10rem,1.3fr)] sm:items-center sm:gap-x-4";

function Amount({ value, className }: { value: number | null; className?: string }) {
  return value === null ? <span className={cn("text-muted-foreground", className)}>—</span> : <Money value={value} className={className} />;
}

/** Running month: share of the monthly budget used so far + amount. */
function SoFar({ row }: { row: CategoryRowStats }) {
  const pct = row.budget > 0 && row.current !== null ? (row.current / row.budget) * 100 : null;
  return (
    <span className="flex items-center gap-3">
      <Meter
        value={pct ?? (row.current ? 100 : 0)}
        tone={pct === null ? (row.current ? "unplanned" : "neutral") : toneForBudgetUsed(pct)}
        size="sm"
        label={`${row.name}: ${pct === null ? "no budget" : `${Math.round(pct)}% of budget`} used so far`}
        className="flex-1"
      />
      <Amount value={row.current} className="min-w-20 text-right text-sm" />
    </span>
  );
}

function Row({ row, cols }: { row: CategoryRowStats; cols: CategoryColumns }) {
  return (
    <li className={cn("flex flex-col gap-2 border-t border-border/40 px-4 py-3 first:border-t-0 sm:px-5", GRID)}>
      <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <span className="truncate">{row.name}</span>
        {row.budget === 0 && <StatusChip tone="unplanned">No budget</StatusChip>}
      </span>
      <Amount value={row.budget > 0 ? row.budget : null} className="hidden text-right text-xs text-muted-foreground sm:block" />
      <span className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground sm:block sm:text-right">
        <span className="sm:hidden">{cols.avgLabel}{row.budget > 0 && <> · budget <Money value={row.budget} /></>}</span>
        <Amount value={row.avg} className={cn("text-sm", row.overBudgetOnAverage ? TONE_CLASSES.danger.text : "text-foreground")} />
      </span>
      <Amount value={row.last} className="hidden text-right text-sm sm:block" />
      {cols.currentLabel && <SoFar row={row} />}
    </li>
  );
}

export function CategoryTrends({ rows, cols }: { rows: CategoryRowStats[]; cols: CategoryColumns }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, TOP_CATEGORIES);
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Spend by category{rows.length > TOP_CATEGORIES && !all ? ` · top ${TOP_CATEGORIES} by average` : ""}
        </h2>
        {rows.length > TOP_CATEGORIES && (
          <button type="button" onClick={() => setAll((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            {all ? "Top 10" : `All ${rows.length}`}
            <ArrowRight className={cn("size-3.5 transition-transform", all && "-rotate-90")} aria-hidden />
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        <div className={cn("hidden border-b border-border/60 px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground", GRID)}>
          <span>Category</span>
          <span className="text-right">Budget / mo</span>
          <span className="text-right">{cols.avgLabel}</span>
          <span className="text-right">{cols.lastLabel ?? ""}</span>
          <span>{cols.currentLabel ?? ""}</span>
        </div>
        <ul>
          {shown.map((r) => (
            <Row key={r.id} row={r} cols={cols} />
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">
        Red average = over budget on average.{cols.currentLabel && " The bar shows how much of this month's budget is used so far."}
      </p>
    </section>
  );
}
