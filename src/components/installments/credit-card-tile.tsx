"use client";

import { useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteCard } from "@/lib/actions/installments";
import { MASK } from "@/components/loans/lib/constants";
import type { CreditCardSummary } from "@/lib/queries/installments";

type Props = {
  card: CreditCardSummary;
  masked?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  selected?: boolean;
  onCardClick?: () => void;
};

export function CreditCardTile({ card, masked, onEdit, onDelete, selected, onCardClick }: Props) {
  const [deletePending, startDelete] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${card.name}"? Linked installments will become uncarded.`)) return;
    startDelete(async () => {
      await deleteCard(card.id);
      onDelete();
    });
  }

  const hasInstallments = card.installmentCount > 0;

  return (
    <div
      role="article"
      aria-label={`Credit card: ${card.name}`}
      onClick={onCardClick}
      className={cn(
        "min-w-72 w-72 shrink-0 rounded-xl border border-border bg-card overflow-hidden transition-opacity",
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

        {/* Action row */}
        <div className="flex items-center gap-1 pt-1 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-xs flex-1"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={deletePending}
            aria-label={`Delete ${card.name}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
