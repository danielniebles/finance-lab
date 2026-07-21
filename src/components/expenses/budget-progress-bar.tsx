import { cn } from "@/lib/utils";

// A bar simply clamped to 100% makes 103% and 300% look identical. Instead:
// 0-100% maps linearly to the first 70% of the track; overage beyond 100%
// compresses (log scale) into the remaining 30%, so a bigger overspend is
// visibly a longer bar, never capped-and-indistinguishable. A tick at 70%
// marks where "100% of budget" sits.
function barWidthPercent(percent: number): number {
  if (percent <= 100) return Math.max(0, percent) * 0.7;
  const over = percent - 100;
  return 70 + Math.min(30, 30 * Math.log10(1 + over / 50));
}

export function BudgetProgressBar({ percent, className }: { percent: number; className?: string }) {
  const barColor =
    percent >= 100 ? "bg-destructive" :
    percent >= 80  ? "bg-warning" :
    "bg-success";

  return (
    <div className={cn("relative h-1.5 w-full rounded-full bg-muted/50", className)}>
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${barWidthPercent(percent)}%` }}
        />
      </div>
      {percent > 100 && (
        <div className="absolute -inset-y-0.5 left-[70%] w-px bg-foreground/30" />
      )}
    </div>
  );
}
