"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = {
  hasActiveFilters: boolean;
  month: number;
  year: number;
};

// Two distinct empty-state copy variants per the design spec: nothing at all
// this month vs. filters narrowing an otherwise non-empty month. Only the
// latter gets a recovery action (reset to groupBy=day, no filters).
export function LedgerEmptyState({ hasActiveFilters, month, year }: Props) {
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
        onClick={() => router.push(`/expenses?view=ledger&month=${month}&year=${year}`)}
      >
        Clear filters
      </Button>
    </div>
  );
}
