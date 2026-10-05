import { formatCOP, formatShort } from "@/lib/format";
import { TONE_CLASSES, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Every peso amount in the UI goes through <Money> — it enforces the Mono
 * Rule (JetBrains Mono, tabular digits) and one formatting rule everywhere.
 *
 * - `compact` → "$ 14.4M" / "$ 380.0k" for tight spots (donut centers, chips).
 * - `signed`  → prefixes "+" for positive values ("−" is always shown).
 * - `tone`    → status color from lib/status (default: inherit color).
 */
export function Money({
  value,
  compact = false,
  signed = false,
  tone,
  className,
}: {
  value: number;
  compact?: boolean;
  signed?: boolean;
  tone?: Tone;
  className?: string;
}) {
  const abs = Math.abs(value);
  const body = compact ? formatShort(abs) : formatCOP(abs);
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : "";

  return (
    <span
      className={cn(
        "font-mono tabular-nums whitespace-nowrap",
        tone && TONE_CLASSES[tone].text,
        className,
      )}
    >
      {sign}
      {body}
    </span>
  );
}
