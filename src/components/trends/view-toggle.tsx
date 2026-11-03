import Link from "next/link";
import { cn } from "@/lib/utils";

export type TrendsView = "pace" | "months";

/** Pace (default) or Months. Keeps the chosen wallet / period in the URL. */
export function TrendsViewToggle({ current, walletId, period }: { current: TrendsView; walletId?: string; period: number }) {
  const href = (view: TrendsView) => {
    const params = new URLSearchParams({ view });
    if (view === "pace" && walletId) params.set("walletId", walletId);
    if (view === "months") params.set("period", String(period));
    return `/trends?${params.toString()}`;
  };
  return (
    <nav aria-label="Trends view" className="flex items-center gap-1 rounded-lg border border-border/60 bg-card p-0.5 max-sm:flex-1">
      {(["pace", "months"] as const).map((view) => (
        <Link
          key={view}
          href={href(view)}
          aria-current={current === view ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-center text-xs font-medium capitalize transition-colors max-sm:flex-1 max-sm:py-1.5",
            current === view ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {view}
        </Link>
      ))}
    </nav>
  );
}
