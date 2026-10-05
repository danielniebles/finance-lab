import { cn } from "@/lib/utils";

/** Card surface used by every Home section (DESIGN.md: card floor, no shadow). */
export function Panel({
  children,
  className,
  glow = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Opt into the theme's decorative wash (--surface-glow). */
  glow?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/60 bg-card p-5 sm:p-6",
        glow && "surface-glow",
        className,
      )}
    >
      {children}
    </section>
  );
}

// ReadingGrid moved to the design system (components/ds) so every page
// wraps long COP amounts the same way.
export { ReadingGrid } from "@/components/ds";
