"use client";

import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = { value: T; label: React.ReactNode; icon?: React.ReactNode };

/**
 * Pick one of a few options (Expense / Income / Transfer, % m.v. / % EA).
 * Selection is neutral on purpose: status colours mean "over budget",
 * "overdue"…, not "this is an expense".
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  size?: "sm" | "md";
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex gap-0.5 rounded-lg border border-border/60 bg-muted p-0.5", size === "md" && "w-full", className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60 [&_svg]:size-3.5",
              size === "md" ? "h-8 text-sm" : "h-6 px-2.5 text-xs",
              selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
