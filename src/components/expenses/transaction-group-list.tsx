"use client";

import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LedgerGroup, LedgerGroupBy } from "@/lib/queries/transactions";
import type { CategoryOption } from "@/lib/queries/expenses";
import { TransactionRow } from "@/components/expenses/transaction-row";

type Props = {
  groups: LedgerGroup[];
  groupBy: LedgerGroupBy;
  categories: CategoryOption[];
};

// Client (not just its TransactionRow children) because every row can carry
// its own edit/delete-confirm local state — see the design spec's pseudo-
// structure, which places this at the client boundary rather than the page.
export function TransactionGroupList({ groups, groupBy, categories }: Props) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {groups.map((group) => (
        <TransactionGroupSection
          key={group.key}
          group={group}
          groupBy={groupBy}
          categories={categories}
        />
      ))}
    </div>
  );
}

function TransactionGroupSection({
  group,
  groupBy,
  categories,
}: {
  group: LedgerGroup;
  groupBy: LedgerGroupBy;
  categories: CategoryOption[];
}) {
  return (
    <div>
      <GroupHeader label={group.label} subtotal={group.subtotal} />
      {group.items.map((item) => (
        <TransactionRow key={item.id} item={item} groupBy={groupBy} categories={categories} />
      ))}
    </div>
  );
}

function GroupHeader({ label, subtotal }: { label: string; subtotal: number }) {
  const tone = subtotal < 0 ? "text-destructive" : subtotal > 0 ? "text-success" : "text-foreground";
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-muted">
      <span className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={cn("font-mono text-lg font-semibold tabular-nums", tone)}>
        {subtotal < 0 ? "-" : ""}
        {formatCOP(Math.abs(subtotal))}
      </span>
    </div>
  );
}
