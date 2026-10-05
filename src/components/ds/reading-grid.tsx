import { cn } from "@/lib/utils";

export type Reading = { label: string; value: React.ReactNode };

/**
 * A row of small labeled readings (Income / Spent / Budget …).
 *
 * COP amounts are long ("+$ 15.132.166"), so the tiles never squeeze: each
 * needs at least `minWidth` and the grid wraps to fewer columns when the card
 * is narrow (auto-fit), instead of letting numbers overflow their cell.
 * Separate tiles rather than hairline dividers, so a wrapped last row never
 * leaves an empty filled cell. A full-width tile puts label and value on one
 * line, so the stacked phone layout stays compact.
 */
export function ReadingGrid({
  items,
  className,
}: {
  items: Reading[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(min(9.5rem,100%),1fr))] gap-2",
        className,
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          // flex-wrap: on a wide (single-column, phone) tile the label and
          // value share one line; on a narrow tile the value wraps under it.
          className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl border border-border/60 bg-background px-3.5 py-2.5"
        >
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="text-sm font-semibold">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
