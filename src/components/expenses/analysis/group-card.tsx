import Link from "next/link";
import { Meter, Money, StatusChip } from "@/components/ds";
import { toneForBudgetUsed } from "@/lib/status";
import { cn } from "@/lib/utils";

type Top = { id: string; name: string; spent: number };

// Fixed or Variable group: spent vs budget with a meter (replaces the rings).
// The whole card is a link that filters the category table to this group.
export function GroupCard({
  title,
  actual,
  budget,
  top,
  unplanned,
  href,
  active,
}: {
  title: string;
  actual: number;
  budget: number;
  top: Top[];
  unplanned?: { total: number; names: string[] };
  href: string;
  active: boolean;
}) {
  const pct = budget > 0 ? (actual / budget) * 100 : null;
  const tone = pct !== null ? toneForBudgetUsed(pct) : "neutral";
  const over = actual - budget;

  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-5 transition-colors hover:bg-muted/30",
        active ? "border-primary/50" : over > 0 ? "border-destructive/40" : "border-border/60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {pct !== null && <StatusChip tone={tone}>{pct.toFixed(0)}% used</StatusChip>}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <Money value={actual} tone={over > 0 ? "danger" : undefined} className="text-2xl font-semibold" />
        <span className="text-sm text-muted-foreground">
          of <Money value={budget} className="text-foreground" />
        </span>
      </div>
      <Meter label={`${title} budget used`} value={pct ?? 0} max={100} tone={tone} />
      <p className="text-xs leading-relaxed text-muted-foreground">
        {over > 0 ? (
          <>
            <Money value={over} tone="danger" /> over.{" "}
            {unplanned && (
              <>
                Unbudgeted {unplanned.names.join(" and ")} account for <Money value={unplanned.total} />.
              </>
            )}
          </>
        ) : top.length > 0 ? (
          <>
            Biggest:{" "}
            {top.map((t, i) => (
              <span key={t.id}>
                {i > 0 && " · "}
                {t.name} <Money value={t.spent} />
              </span>
            ))}
          </>
        ) : (
          "Nothing spent yet."
        )}
      </p>
    </Link>
  );
}
