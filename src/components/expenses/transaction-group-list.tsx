"use client";

import { formatCOP } from "@/lib/format";
import type { LedgerGroup, LedgerGroupBy } from "@/lib/queries/transactions";
import type { CategoryOption } from "@/lib/queries/expenses";
import type { TagOption } from "@/lib/queries/tags";
import { TransactionRow } from "@/components/expenses/transaction-row";

type Props = {
  groups: LedgerGroup[];
  groupBy: LedgerGroupBy;
  categories: CategoryOption[];
  walletOptions: { id: string; name: string }[];
  tags: TagOption[];
};

// Client (not just its TransactionRow children) because every row can carry
// its own edit/delete-confirm local state — see the design spec's pseudo-
// structure, which places this at the client boundary rather than the page.
export function TransactionGroupList({ groups, groupBy, categories, walletOptions, tags }: Props) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {groups.map((group) => (
        <TransactionGroupSection
          key={group.key}
          group={group}
          groupBy={groupBy}
          categories={categories}
          walletOptions={walletOptions}
          tags={tags}
        />
      ))}
    </div>
  );
}

function TransactionGroupSection({
  group,
  groupBy,
  categories,
  walletOptions,
  tags,
}: {
  group: LedgerGroup;
  groupBy: LedgerGroupBy;
  categories: CategoryOption[];
  walletOptions: { id: string; name: string }[];
  tags: TagOption[];
}) {
  return (
    <div>
      <GroupHeader label={group.label} subtotal={group.subtotal} />
      {group.items.map((item) => (
        <TransactionRow
          key={item.id}
          item={item}
          groupBy={groupBy}
          categories={categories}
          walletOptions={walletOptions}
          tags={tags}
        />
      ))}
    </div>
  );
}

function GroupHeader({ label, subtotal }: { label: string; subtotal: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-muted">
      <span className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
        {subtotal < 0 ? "-" : "+"}
        {formatCOP(Math.abs(subtotal))}
      </span>
    </div>
  );
}
