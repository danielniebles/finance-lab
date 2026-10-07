"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buildLedgerUrl } from "@/components/expenses/ledger-controls";
import type { LedgerFilters } from "@/lib/queries/transactions";

type Props = {
  hasActiveFilters: boolean;
  month: number;
  year: number;
  filters: LedgerFilters;
};

// Two distinct empty-state copy variants per the design spec: nothing at all
// this month vs. filters narrowing an otherwise non-empty month. Only the
// latter gets a recovery action (clear the filters, keep the wallet).
export function LedgerEmptyState({ hasActiveFilters, month, year, filters }: Props) {
  const router = useRouter();

  if (!hasActiveFilters) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
        No transactions this period.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground space-y-3">
      <p>No transactions match these filters.</p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          router.push(buildLedgerUrl(month, year, filters, { category: "", type: "", search: "", tagId: "" }))
        }
      >
        Clear filters
      </Button>
    </div>
  );
}
