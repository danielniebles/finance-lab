"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { formatCOP } from "@/lib/format";
import { deleteVaultEntry } from "@/lib/actions/vaults";
import { cn } from "@/lib/utils";
import type { VaultEntryRow } from "@/lib/queries/vaults";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

// ─── Entry row ────────────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: VaultEntryRow }) {
  const [pending, startTransition] = useTransition();
  const isContribution = entry.amount > 0;
  const absAmount = Math.abs(entry.amount);

  function handleDelete() {
    if (!confirm("Delete this entry?")) return;
    startTransition(async () => {
      await deleteVaultEntry(entry.id);
    });
  }

  return (
    <div role="listitem" className="flex items-center gap-3 py-3 px-1 group">
      {/* Date */}
      <span className="font-mono text-xs text-muted-foreground tabular-nums w-16 shrink-0">
        {formatDate(entry.date)}
      </span>

      {/* Notes */}
      <span className="flex-1 text-sm text-foreground truncate min-w-0">
        {entry.notes ?? (isContribution ? "Contribution" : "Withdrawal")}
      </span>

      {/* Amount */}
      <span
        className={cn(
          "font-mono text-sm font-semibold tabular-nums shrink-0",
          isContribution ? "text-success" : "text-destructive",
        )}
        aria-label={`${isContribution ? "Contribution" : "Withdrawal"} of ${formatCOP(absAmount)}`}
      >
        {isContribution ? "+" : "−"}
        {formatCOP(absAmount)}
      </span>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon"
        className="size-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-label={`Delete entry from ${formatDate(entry.date)}`}
        onClick={handleDelete}
        disabled={pending}
      >
        <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
      </Button>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultName: string;
  balance: number;
  entries: VaultEntryRow[];
  onContribute: () => void;
  onWithdraw: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function VaultLedger({
  open,
  onOpenChange,
  vaultName,
  balance,
  entries,
  onContribute,
  onWithdraw,
}: Props) {
  // Safety guard: limit to 50 entries; data will be small in practice
  const displayEntries = entries.slice(0, 50);
  const hasMore = entries.length > 50;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[480px] sm:max-w-[480px] flex flex-col gap-0 p-0"
      >
        <SheetHeader className="border-b border-border/60 px-5 pt-5 pb-4">
          <SheetTitle className="font-heading text-base font-semibold">
            {vaultName} — History
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entry" : "entries"} ·
            Balance:{" "}
            <span className="font-mono tabular-nums">{formatCOP(balance)}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4 px-5">
          {displayEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No entries yet.
            </p>
          ) : (
            <>
              <div
                className="divide-y divide-border/50"
                role="list"
                aria-label="Entry history"
              >
                {displayEntries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} />
                ))}
              </div>
              {hasMore && (
                <p className="text-xs text-muted-foreground text-center mt-4">
                  Showing first 50 entries.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 p-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onContribute}
          >
            + Add contribution
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={onWithdraw}
          >
            − Withdraw
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
