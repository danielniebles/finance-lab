import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { TONE_CLASSES, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * One row of a list: [icon tile] title/subtitle … trailing.
 * Used by vault goals, installments, debtors, wallets. Renders as a link
 * when `href` is set (whole row is the hit target).
 */
export function ListRow({
  icon: Icon,
  iconTone = "neutral",
  title,
  subtitle,
  trailing,
  href,
  className,
}: {
  icon?: LucideIcon;
  iconTone?: Tone;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const content = (
    <>
      {Icon && (
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            TONE_CLASSES[iconTone].soft,
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-foreground">{title}</span>
        {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-3">{trailing}</span>}
    </>
  );

  const classes = cn("flex min-h-11 items-center gap-3 py-2", className);

  return href ? (
    <Link href={href} className={cn(classes, "rounded-lg transition-colors hover:bg-muted/50")}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
