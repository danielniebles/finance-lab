"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Money, SectionHeader } from "@/components/ds";
import { cn } from "@/lib/utils";
import { buildLedgerUrl } from "@/components/expenses/ledger-controls";
import type { CategorySummaryRow, LedgerGroupBy, LedgerFilters } from "@/lib/queries/transactions";

type Props = {
  rows: CategorySummaryRow[];
  month: number;
  year: number;
  groupBy: LedgerGroupBy;
  filters: LedgerFilters;
};

// Chart series tokens, by spend rank (DESIGN.md: never status colours).
const SERIES = ["bg-chart-1", "bg-chart-2", "bg-chart-5", "bg-chart-3", "bg-chart-6", "bg-chart-7", "bg-chart-8", "bg-chart-4"];
const OTHER = "bg-muted-foreground/50";
const VISIBLE = 6;

// Where the month's money went: one stacked bar + a chip per category.
// Clicking a chip filters the list below to that category (the same
// re-query LedgerControls drives); clicking the active chip clears it.
// Always visible — the old collapsed "Categories (N)" list hid this.
export function CategorySummaryPanel({ rows, month, year, groupBy, filters }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAll, setShowAll] = useState(false);

  const spending = rows
    .filter((r) => r.total < 0)
    .map((r) => ({ ...r, spent: Math.abs(r.total) }))
    .sort((a, b) => b.spent - a.spent);
  if (spending.length === 0) return null;

  const top = spending.slice(0, VISIBLE);
  const rest = spending.slice(VISIBLE);
  const restTotal = rest.reduce((s, r) => s + r.spent, 0);
  const chips = showAll ? spending : top;

  function colorOf(index: number): string {
    return index < VISIBLE ? SERIES[index] : OTHER;
  }

  function toggle(name: string) {
    const nextCategory = filters.category === name ? "" : name;
    startTransition(() => {
      router.push(buildLedgerUrl(month, year, groupBy, filters, { category: nextCategory }));
    });
  }

  return (
    <section className={cn("flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 transition-opacity", isPending && "pointer-events-none opacity-60")}>
      <SectionHeader
        title={`By category · ${spending.length}`}
        trailing={<span className="text-xs text-muted-foreground max-sm:hidden">Click to filter</span>}
      />
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {top.map((r, i) => (
          <div key={r.name} className={cn("min-w-1", colorOf(i))} style={{ flexGrow: r.spent }} />
        ))}
        {restTotal > 0 && <div className={cn("min-w-1", OTHER)} style={{ flexGrow: restTotal }} />}
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((r, i) => {
          const active = filters.category === r.name;
          return (
            <button
              key={r.name}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(r.name)}
              className={cn(
                "flex h-8 items-center gap-2 rounded-full border px-3 text-xs transition-colors",
                active ? "border-primary bg-primary/10" : "border-border/60 bg-background hover:bg-muted/50",
              )}
            >
              <span className={cn("size-2 shrink-0 rounded-sm", colorOf(i))} />
              <span className="font-medium">{r.name}</span>
              <Money value={r.spent} compact className="text-muted-foreground" />
            </button>
          );
        })}
        {rest.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="flex h-8 items-center gap-2 rounded-full border border-dashed border-border px-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {showAll ? (
              "Show less"
            ) : (
              <>
                <span className={cn("size-2 shrink-0 rounded-sm", OTHER)} />
                {rest.length} more <Money value={restTotal} compact />
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
