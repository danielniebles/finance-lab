import { cn } from "@/lib/utils";

/**
 * Dot in a user-chosen colour (account, card, wallet). The colour is user
 * data, so it's applied inline; with no colour it falls back to the muted
 * token instead of a hard-coded grey.
 */
export function ColorDot({ color, title, className }: { color: string | null | undefined; title?: string; className?: string }) {
  return (
    <span
      aria-hidden={title ? undefined : true}
      title={title}
      className={cn("inline-block size-2 shrink-0 rounded-full", !color && "bg-muted-foreground", className)}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}
