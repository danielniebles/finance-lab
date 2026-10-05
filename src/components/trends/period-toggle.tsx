import Link from "next/link";
import { cn } from "@/lib/utils";

export const TREND_PERIODS = [3, 6, 12] as const;

export function PeriodToggle({ current }: { current: number }) {
  return (
    <nav aria-label="Trend period" className="flex items-center gap-1 rounded-lg border border-border/60 bg-card p-0.5">
      {TREND_PERIODS.map((n) => (
        <Link
          key={n}
          href={`?period=${n}`}
          aria-current={current === n ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            current === n ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {n} mo
        </Link>
      ))}
    </nav>
  );
}
