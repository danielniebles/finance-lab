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

/** Two-to-four up grid of small labeled readings separated by hairlines. */
export function ReadingGrid({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60",
        items.length === 4 ? "grid-cols-2" : "grid-cols-3",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1 bg-background px-3.5 py-3">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="font-mono text-sm font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
