"use client";

import { Money, StatusChip } from "@/components/ds";
import { MASK } from "@/components/loans/lib/constants";
import type { DueLabel } from "@/lib/installment-display";
import type { CreditCardSummary } from "@/lib/queries/installments";
import { cn } from "@/lib/utils";

type Props = {
  card: CreditCardSummary;
  /** Due/paid chip for the viewed month (null = nothing due on this card). */
  status: DueLabel | null;
  masked?: boolean;
  selected?: boolean;
  onCardClick?: () => void;
};

// Click a card to filter the page to it; click again to clear (unchanged).
export function CreditCardTile({ card, status, masked, selected, onCardClick }: Props) {
  const hasInstallments = card.installmentCount > 0;

  return (
    <button
      type="button"
      aria-pressed={selected === true}
      aria-label={`Credit card ${card.name}${selected ? ", selected" : ""}`}
      onClick={onCardClick}
      className={cn(
        "flex h-full w-72 shrink-0 flex-col gap-3.5 rounded-2xl border bg-card p-4 text-left transition-[opacity,border-color]",
        selected === true ? "border-primary/70" : "border-border/60 hover:border-border",
        selected === false && "opacity-60",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-full"
            // Card colour is user data (picked in Manage cards), not a theme colour.
            style={{ backgroundColor: card.color ?? "var(--muted-foreground)" }}
          />
          <span className="truncate text-sm font-semibold">{card.name}</span>
        </span>
        {status && <StatusChip tone={status.tone}>{status.label}</StatusChip>}
      </span>

      {hasInstallments ? (
        <>
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">This month</span>
            {masked ? (
              <span className="font-mono text-lg font-semibold">{MASK}</span>
            ) : (
              <Money value={card.monthlyObligation} className="text-lg font-semibold" />
            )}
          </span>
          <span className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span>
              {card.installmentCount} installment{card.installmentCount !== 1 ? "s" : ""}
            </span>
            <span>
              Owed{" "}
              {masked ? <span className="font-mono text-foreground">{MASK}</span> : <Money value={card.outstandingDebt} className="text-foreground" />}
            </span>
          </span>
        </>
      ) : (
        <span className="text-sm text-muted-foreground">No installments</span>
      )}
    </button>
  );
}
