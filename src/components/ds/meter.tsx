import { TONE_CLASSES, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Horizontal progress meter on the themed `meter-track`.
 *
 * - `value` / `max` set the fill (clamped to the track).
 * - `target` (same unit as value) draws a tick, e.g. the 20% savings target
 *   on a 0–40% scale.
 * - `label` is required: it names the meter for screen readers.
 */
export function Meter({
  value,
  max = 100,
  target,
  tone = "positive",
  label,
  size = "md",
  className,
}: {
  value: number;
  max?: number;
  target?: number;
  tone?: Tone;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const targetPct =
    target !== undefined && max > 0 ? Math.min(100, Math.max(0, (target / max) * 100)) : null;

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn(
        "relative w-full rounded-full bg-meter-track",
        size === "sm" ? "h-1.5" : "h-2",
        className,
      )}
    >
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-[width]", TONE_CLASSES[tone].fill)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {targetPct !== null && (
        <div
          aria-hidden
          data-slot="meter-target"
          className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
          style={{ left: `${targetPct}%` }}
        />
      )}
    </div>
  );
}
