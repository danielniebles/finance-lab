"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Money, SectionHeader } from "@/components/ds";
import { cn } from "@/lib/utils";
import { buildLedgerUrl } from "@/components/expenses/ledger-controls";
import { ALL_WALLETS } from "@/lib/expenses-ledger-display";
import type { CategorySummaryRow, LedgerFilters } from "@/lib/queries/transactions";

type Props = {
  rows: CategorySummaryRow[];
  /** The selected wallet; undefined = all wallets. */
  walletName: string | undefined;
  month: number;
  year: number;
  filters: LedgerFilters;
};

// Chart series tokens, by spend rank (DESIGN.md: never status colours).
const SERIES = ["bg-chart-1", "bg-chart-2", "bg-chart-5", "bg-chart-3", "bg-chart-6", "bg-chart-7", "bg-chart-8", "bg-chart-4"];
const OTHER = "bg-muted-foreground/50";
const VISIBLE = 6;
const FADED = "opacity-45";

function colorOf(index: number): string {
  return index < VISIBLE ? SERIES[index] : OTHER;
}

function analysisHref(month: number, year: number, walletId: string | undefined): string {
  const params = new URLSearchParams({ view: "analysis", month: String(month), year: String(year), walletId: walletId ?? ALL_WALLETS });
  return `/expenses?${params.toString()}`;
}

// Where the wallet's money went this month: one stacked bar + a chip per
// category. Clicking a chip filters the list below to that category (the
// same re-query LedgerControls drives); clicking the active chip clears it.
// The rows ignore the category filter (getTransactionList), so the other
// chips stay visible, faded, while one is selected.
export function CategorySummaryPanel({ rows, walletName, month, year, filters }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAll, setShowAll] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  // Phones: if the selected chip sits outside the sideways row (e.g. after a
  // reload), scroll the row — only the row, never the page — to show it.
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (!row || !chip) return;
    const outside = chip.offsetLeft < row.scrollLeft || chip.offsetLeft + chip.offsetWidth > row.scrollLeft + row.clientWidth;
    if (outside) row.scrollTo({ left: chip.offsetLeft - 20, behavior: "smooth" });
  }, [filters.category]);

  const spending = rows
    .filter((r) => r.total < 0)
    .map((r) => ({ ...r, spent: Math.abs(r.total) }))
    .sort((a, b) => b.spent - a.spent)
    .map((r, i) => ({ ...r, color: colorOf(i) }));
  if (spending.length === 0) return null;

  const top = spending.slice(0, VISIBLE);
  const rest = spending.slice(VISIBLE);
  const restTotal = rest.reduce((s, r) => s + r.spent, 0);
  const total = spending.reduce((s, r) => s + r.spent, 0);
  const selected = filters.category;
  const hiddenSelected = rest.find((r) => r.name === selected);
  const chips = showAll ? spending : hiddenSelected ? [...top, hiddenSelected] : top;

  function toggle(name: string) {
    const nextCategory = selected === name ? "" : name;
    startTransition(() => {
      router.push(buildLedgerUrl(month, year, filters, { category: nextCategory }));
    });
  }

  return (
    <section className={cn("flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 transition-opacity", isPending && "pointer-events-none opacity-60")}>
      <SectionHeader
        title={`${walletName ?? "All wallets"} · by category`}
        trailing={<Money value={total} compact className="text-xs text-muted-foreground" />}
        href={analysisHref(month, year, filters.walletId)}
        linkLabel="Analysis"
      />
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {top.map((r) => (
          <div
            key={r.name}
            className={cn("min-w-1 transition-opacity", r.color, selected && selected !== r.name && FADED)}
            style={{ flexGrow: r.spent }}
          />
        ))}
        {restTotal > 0 && (
          <div className={cn("min-w-1", OTHER, selected && !hiddenSelected && FADED)} style={{ flexGrow: restTotal }} />
        )}
      </div>
      {/* Phones: one sideways-scrolling row, chips keep their place. sm+: wraps. */}
      <div ref={rowRef} className="no-scrollbar relative -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0">
        {chips.map((r) => (
          <CategoryChip
            key={r.name}
            row={r}
            active={selected === r.name}
            faded={Boolean(selected) && selected !== r.name}
            onClick={() => toggle(r.name)}
          />
        ))}
        {rest.length > 0 && (
          <button
            type="button"
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-border px-3 text-xs whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
          >
            {showAll ? (
              "Show less"
            ) : (
              <>
                +{rest.length} more <Money value={restTotal} compact />
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}

function CategoryChip({
  row,
  active,
  faded,
  onClick,
}: {
  row: { name: string; spent: number; color: string };
  active: boolean;
  faded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `${row.name}, selected. Click to clear` : undefined}
      onClick={onClick}
      className={cn(
        "flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-xs whitespace-nowrap transition-[opacity,background-color]",
        active
          ? "border-primary bg-primary/10 font-semibold"
          : "border-border/60 bg-background hover:bg-muted/50",
        faded && `${FADED} hover:opacity-100`,
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-sm", row.color)} />
      <span className={active ? undefined : "font-medium"}>{row.name}</span>
      <Money value={row.spent} compact className="text-muted-foreground" />
      {active && <X className="size-3.5" aria-hidden />}
    </button>
  );
}
