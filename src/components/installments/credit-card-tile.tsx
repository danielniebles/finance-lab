"use client";

import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MASK } from "@/components/loans/lib/constants";
import type { CreditCardSummary } from "@/lib/queries/installments";

type Props = {
  card: CreditCardSummary;
  masked?: boolean;
  selected?: boolean;
  onCardClick?: () => void;
};

export function CreditCardTile({ card, masked, selected, onCardClick }: Props) {
  const hasInstallments = card.installmentCount > 0;

  return (
    <div
      role="article"
      aria-label={`Credit card: ${card.name}`}
      onClick={onCardClick}
      className={cn(
        "min-w-72 w-72 h-full shrink-0 rounded-xl border border-border bg-card overflow-hidden transition-opacity",
        onCardClick && "cursor-pointer",
        selected === true && "ring-2 ring-primary/70",
        selected === false && "opacity-60",
      )}
    >
      <div className="p-4 flex flex-col gap-3 h-full">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="size-3 rounded-full shrink-0"
              style={{ backgroundColor: card.color ?? "#888" }}
            />
            <span className="font-medium text-sm truncate">{card.name}</span>
          </div>
          <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0">
            Credit Card
          </span>
        </div>

        {/* Amounts */}
        <div className="flex-1 space-y-1">
          {hasInstallments ? (
            <>
              <p className="font-mono text-lg font-semibold text-destructive">
                {masked ? MASK : formatCOP(card.outstandingDebt)}
              </p>
              <p className="text-xs text-muted-foreground">
                {card.installmentCount} installment{card.installmentCount !== 1 ? "s" : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No installments</p>
          )}
        </div>

        {/* Monthly obligation + due day */}
        {hasInstallments && (
          <div className="space-y-0.5">
            <p className="font-mono text-sm text-foreground">
              This month:{" "}
              <span className="font-semibold">
                {masked ? MASK : formatCOP(card.monthlyObligation)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {card.paymentDueDay != null ? `Due: ${card.paymentDueDay}th` : "Due: —"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
