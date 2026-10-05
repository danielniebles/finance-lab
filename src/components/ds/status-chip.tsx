import { TONE_CLASSES, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Small status pill ("Underfunded", "Over budget", "Paid"). The tone comes
 * from a lib/status mapping (toneForVaultStatus, toneForCategorySeverity …),
 * never from hand-picked classes, so the same state looks the same on every
 * screen and in every theme.
 */
export function StatusChip({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-medium [&>svg]:size-3",
        TONE_CLASSES[tone].soft,
        className,
      )}
    >
      {children}
    </span>
  );
}
