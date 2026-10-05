import { TONE_CLASSES, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * The labeled numeric reading (DESIGN.md "StatCard"). `value` is a node so
 * callers pass <Money> or a mono percentage; `tone` colors the value only.
 */
export function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 rounded-xl border border-border/60 bg-card px-5 py-4", className)}>
      <p className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className={cn("font-mono text-xl font-semibold tabular-nums", TONE_CLASSES[tone].text)}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
