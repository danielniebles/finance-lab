import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Section heading (DESIGN.md "Section Label": Sora, 12px, uppercase, muted)
 * with optional trailing content and/or a "View …" link.
 */
export function SectionHeader({
  title,
  href,
  linkLabel = "View all",
  trailing,
  as: Heading = "h2",
  className,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  trailing?: React.ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    // Wraps on narrow screens: a long trailing ("Still needed $ 1.613.400 ·
    // Fund vaults →") must never force its card wider than the viewport.
    <div className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-1", className)}>
      <Heading className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </Heading>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {trailing}
        {href && (
          <Link
            href={href}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {linkLabel}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}
