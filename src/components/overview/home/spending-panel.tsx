import Link from "next/link";
import { Meter, Money, SectionHeader } from "@/components/ds";
import { resolveEffectiveCategoryStyle } from "@/lib/category-style";
import type { CategorySeverity } from "@/lib/queries/expenses";
import { TONE_CLASSES, toneForBudgetUsed, toneForCategorySeverity, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Panel } from "./panel";

export type SpendingRow = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  spent: number;
  budget: number;
  percentUsed: number | null;
  severity: CategorySeverity;
};

const MAX_ROWS = 6;

function statusLabel(row: SpendingRow): { tone: Tone; text: string } {
  if (row.budget === 0) return { tone: toneForCategorySeverity("Unplanned"), text: "no budget" };
  const pct = row.percentUsed ?? 0;
  if (pct > 100) return { tone: toneForBudgetUsed(pct), text: `${Math.round(pct - 100)}% over` };
  return { tone: "neutral", text: `${Math.round(pct)}% of budget` };
}

export function ledgerCategoryHref(name: string): string {
  return `/expenses?view=ledger&category=${encodeURIComponent(name)}`;
}

function Row({ row, max }: { row: SpendingRow; max: number }) {
  const style = resolveEffectiveCategoryStyle(row.name, row.icon, row.color);
  const Icon = style.icon;
  const status = statusLabel(row);
  return (
    <li>
      <Link
        href={ledgerCategoryHref(row.name)}
        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40"
      >
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", style.iconWrap)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{row.name}</span>
            <Money value={row.spent} />
          </span>
          <Meter label={`${row.name} share of top spending`} value={row.spent} max={max} tone={status.tone === "neutral" ? "info" : status.tone} size="sm" />
          <span className={cn("text-xs", TONE_CLASSES[status.tone].text, status.tone === "neutral" && "text-muted-foreground")}>
            {status.text}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function topSpending(rows: SpendingRow[]): SpendingRow[] {
  return rows.filter((r) => r.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, MAX_ROWS);
}

export function SpendingPanel({
  monthLabel,
  rows,
  totalExpenses,
}: {
  monthLabel: string;
  rows: SpendingRow[];
  totalExpenses: number;
}) {
  const top = topSpending(rows);
  const max = top[0]?.spent ?? 0;
  return (
    <Panel className="flex flex-col gap-3">
      <SectionHeader
        title={`Where ${monthLabel} is going`}
        href="/expenses?view=analysis"
        linkLabel="All categories"
        trailing={<Money value={totalExpenses} compact className="text-xs text-muted-foreground" />}
      />
      {top.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">No spending logged this month yet.</p>
      ) : (
        <ul className="flex flex-col">
          {top.map((r) => (
            <Row key={r.id} row={r} max={max} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
