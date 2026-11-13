import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Money, SectionHeader, StatusChip } from "@/components/ds";
import { buildExpensesUrl } from "@/lib/build-expenses-url";
import { resolveEffectiveCategoryStyle } from "@/lib/category-style";
import { ALL_WALLETS } from "@/lib/expenses-ledger-display";
import { UNCATEGORIZED } from "@/lib/period-comparison-utils";
import type { CategoryChanges, PaceCategoryRow } from "@/lib/spending-pace-display";
import { toneForSpendDelta } from "@/lib/status";
import { cn } from "@/lib/utils";

// Fixed amount columns, so both cards (and their headers) line up; the name
// takes what's left and truncates. Columns from a 32rem-wide card, else stacked.
const GRID = "@lg:grid @lg:grid-cols-[minmax(0,1fr)_6rem_6rem_6.5rem] @lg:items-center @lg:gap-x-3";

type LedgerScope = { month: number; year: number; walletId?: string };

function RowBody({ row }: { row: PaceCategoryRow }) {
  const style = resolveEffectiveCategoryStyle(row.category === UNCATEGORIZED ? null : row.category, row.icon, row.color);
  const Icon = style.icon;
  const tone = toneForSpendDelta(row.delta);
  return (
    <>
      <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
        <span aria-hidden className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", style.iconWrap)}>
          <Icon className="size-3.5" />
        </span>
        {/* Chips under the name, so they never squeeze it in the narrow column. */}
        <span className="flex min-w-0 flex-col items-start gap-1">
          <span className="max-w-full truncate" title={row.category}>{row.category}</span>
          {(row.isNew || row.notPaidYet) && (
            <span className="flex gap-1">
              {row.isNew && <StatusChip tone="info">New</StatusChip>}
              {row.notPaidYet && <StatusChip tone="info">Not paid yet</StatusChip>}
            </span>
          )}
        </span>
        <Money value={row.delta} signed tone={tone} className="ml-auto text-sm font-semibold @lg:hidden" />
      </span>
      <span className="pl-9.5 text-xs text-muted-foreground @lg:hidden">
        <Money value={row.current} /> vs <Money value={row.previous} />
      </span>
      <Money value={row.current} className="hidden text-right text-sm @lg:block" />
      <Money value={row.previous} className="hidden text-right text-sm text-muted-foreground @lg:block" />
      <Money value={row.delta} signed tone={tone} className="hidden text-right text-sm font-semibold @lg:block" />
    </>
  );
}

function Row({ row, scope }: { row: PaceCategoryRow; scope: LedgerScope }) {
  const className = cn("flex min-h-11 flex-col gap-1.5 border-t border-border/40 px-4 py-3 sm:px-5 sm:py-2.5", GRID);
  if (row.category === UNCATEGORIZED) return <li className={className}><RowBody row={row} /></li>;
  const href = buildExpensesUrl({}, {
    month: String(scope.month),
    year: String(scope.year),
    walletId: scope.walletId ?? ALL_WALLETS,
    category: row.category,
  });
  return (
    <li>
      <Link href={href} className={cn(className, "transition-colors hover:bg-muted/40")}>
        <RowBody row={row} />
      </Link>
    </li>
  );
}

function ChangeList({ title, direction, rows, scope, footnote }: {
  title: string;
  direction: "more" | "less";
  rows: PaceCategoryRow[];
  scope: LedgerScope;
  footnote?: string;
}) {
  const Icon = direction === "more" ? ArrowUpRight : ArrowDownRight;
  const tone = direction === "more" ? "caution" : "positive";
  return (
    <div className="@container flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className="flex items-center gap-2 px-4 py-3.5 sm:px-5">
        <Icon aria-hidden className={cn("size-4", tone === "caution" ? "text-warning" : "text-success")} />
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        <span className="font-mono text-xs text-muted-foreground">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="border-t border-border/40 px-4 py-6 text-sm text-muted-foreground sm:px-5">No categories so far.</p>
      ) : (
        <>
          <div className={cn("hidden border-t border-border/40 bg-muted/40 px-5 py-2 font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground", GRID)}>
            <span>Category</span>
            <span className="text-right">This</span>
            <span className="text-right">Last</span>
            <span className="text-right">Difference</span>
          </div>
          {/* Desktop: both cards share the taller one's height; long lists scroll inside. */}
          <ul className="overflow-x-hidden xl:max-h-96 xl:overflow-y-auto">
            {rows.map((row) => <Row key={row.category} row={row} scope={scope} />)}
          </ul>
        </>
      )}
      {footnote && <p className="mt-auto border-t border-border/40 px-4 py-3 text-xs text-muted-foreground sm:px-5">{footnote}</p>}
    </div>
  );
}

/** Categories that moved against the same days last period, split by direction. */
export function CategoryChangesSection({ changes, scope }: { changes: CategoryChanges; scope: LedgerScope }) {
  const unpaid = changes.less.filter((r) => r.notPaidYet).map((r) => r.category);
  const footnote = unpaid.length
    ? `${unpaid.join(", ")} ${unpaid.length === 1 ? "has a bill" : "have bills"} not paid yet this period, so part of this gap is timing, not saving.`
    : undefined;
  return (
    <section className="flex flex-col gap-3">
      <SectionHeader
        title="What changed · by category"
        trailing={
          <span className="text-xs text-muted-foreground">
            <Money value={changes.moreTotal} signed className="text-foreground" /> in {changes.more.length},{" "}
            <Money value={changes.lessTotal} signed className="text-foreground" /> in {changes.less.length}
            {changes.unchanged > 0 && ` · ${changes.unchanged} unchanged`}
          </span>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <ChangeList title="Spending more" direction="more" rows={changes.more} scope={scope} />
        <ChangeList title="Spending less" direction="less" rows={changes.less} scope={scope} footnote={footnote} />
      </div>
    </section>
  );
}
