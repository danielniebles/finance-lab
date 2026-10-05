"use client";

import { useState } from "react";
import { SectionHeader } from "@/components/ds";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { needsMoney, sortVaultsByUrgency, type NextDue } from "@/lib/vault-display";
import { cn } from "@/lib/utils";
import type { VaultWithMetrics } from "@/lib/queries/vaults";
import { VaultTile } from "./vault-tile";

type Filter = "attention" | "all";

type Props = {
  vaults: VaultWithMetrics[];
  nextDue: Map<string, NextDue>;
  onContribute: (vaultId: string) => void;
  onEdit: (vaultId: string) => void;
  onHistory: (vaultId: string) => void;
};

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// One fixed-height row at every breakpoint (a wrapping grid pushed Recurring
// expenses far down once there were many vaults, and broke into two lines on
// desktop). Sorted by urgency, and filtered to "Needs money" by default so the
// row usually holds only what needs action — "All" is one click away.
export function VaultCarousel({ vaults, nextDue, onContribute, onEdit, onHistory }: Props) {
  const sorted = sortVaultsByUrgency(vaults);
  const attention = sorted.filter(needsMoney);
  // Nothing needs money → default to showing everything instead of an empty row.
  const [filter, setFilter] = useState<Filter>(attention.length > 0 ? "attention" : "all");
  const shown = filter === "attention" ? attention : sorted;

  return (
    <section aria-label="Vaults" className="flex flex-col gap-3">
      <SectionHeader
        title="Vaults"
        trailing={
          <div className="flex items-center gap-0.5 rounded-lg border border-border/60 p-0.5" role="group" aria-label="Filter vaults">
            <FilterButton active={filter === "attention"} onClick={() => setFilter("attention")}>
              Needs money ({attention.length})
            </FilterButton>
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
              All ({sorted.length})
            </FilterButton>
          </div>
        }
      />
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Every vault is funded for this month.
        </p>
      ) : (
        <Carousel opts={{ align: "start" }}>
          <CarouselContent>
            {shown.map((v) => (
              // py-1: room for the tile border — the viewport's overflow-hidden
              // otherwise clips it flush at the top/bottom edge.
              <CarouselItem key={v.id} className="basis-[85%] py-1 sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                <VaultTile
                  vault={v}
                  nextDue={nextDue.get(v.id)}
                  onContribute={() => onContribute(v.id)}
                  onEdit={() => onEdit(v.id)}
                  onHistory={() => onHistory(v.id)}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          {/* Inside the carousel bounds so the page padding doesn't clip them;
              disabled:hidden drops a button once there's nothing left to reach. */}
          <CarouselPrevious className="left-2 disabled:hidden" />
          <CarouselNext className="right-2 disabled:hidden" />
        </Carousel>
      )}
    </section>
  );
}
