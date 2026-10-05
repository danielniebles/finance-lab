import { cn } from "@/lib/utils";

/** Account colour dot. The colour is user data; no colour → muted token. */
export function AccountDot({ color, title, className }: { color: string | null; title?: string; className?: string }) {
  return (
    <span
      aria-hidden={title ? undefined : true}
      title={title}
      className={cn("size-2 shrink-0 rounded-full", !color && "bg-muted-foreground", className)}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}
