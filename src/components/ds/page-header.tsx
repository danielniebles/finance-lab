import { cn } from "@/lib/utils";

/**
 * Top of a page (DESIGN.md §7 "Page actions").
 *
 * - `action`: the page's one primary action (usually a `HeaderAction`),
 *   top right. On phones it stays on the title row.
 * - `controls`: page controls in outline — month navigation, privacy, a
 *   secondary action. Left of the action from `sm` up; on phones a
 *   full-width row under the description; a control that should stretch
 *   across it (a month nav, Transfer) sets `max-sm:flex-1` itself.
 *
 * Section-level actions (Manage cards, Add account…) belong in that
 * section's SectionHeader, not here.
 */
export function PageHeader({
  title,
  description,
  action,
  controls,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  controls?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2",
        "sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end",
        className,
      )}
    >
      <h1 className="col-start-1 row-start-1 min-w-0 font-heading text-2xl font-semibold">{title}</h1>
      {description && (
        <p className="col-span-2 row-start-2 max-w-prose text-sm text-muted-foreground sm:col-span-1 sm:col-start-1">
          {description}
        </p>
      )}
      {controls && (
        <div className="col-span-2 row-start-3 flex items-center gap-2 sm:col-span-1 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:self-end">
          {controls}
        </div>
      )}
      {action && (
        <div className="col-start-2 row-start-1 justify-self-end sm:col-start-3 sm:row-span-2 sm:self-end">{action}</div>
      )}
    </header>
  );
}
