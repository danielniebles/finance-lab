"use client";

import { Check, X } from "lucide-react";
import { PRESET_COLORS } from "@/lib/color-presets";
import { cn } from "@/lib/utils";

/**
 * Pick one of the preset colours for something the user owns (vault,
 * account, card). The colours are user data, applied inline; the selected
 * one gets a check. `allowNone` adds a "No colour" swatch that maps to null.
 */
export function ColorPicker({
  value,
  onChange,
  allowNone = false,
  disabled,
  ariaLabel = "Colour",
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  allowNone?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const swatch = "relative flex size-8 items-center justify-center rounded-full transition-transform outline-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:opacity-50";
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap items-center gap-2">
      {PRESET_COLORS.map((c) => {
        const selected = value?.toLowerCase() === c.value.toLowerCase();
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.label}
            disabled={disabled}
            onClick={() => onChange(c.value)}
            className={cn(swatch, selected ? "ring-2 ring-foreground/70 ring-offset-2 ring-offset-card" : "hover:scale-110")}
            style={{ backgroundColor: c.value }}
          >
            {selected && <Check className="size-4 text-background" strokeWidth={3} aria-hidden />}
          </button>
        );
      })}
      {allowNone && (
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          aria-label="No colour"
          disabled={disabled}
          onClick={() => onChange(null)}
          className={cn(
            swatch,
            "border border-border bg-muted",
            value === null ? "ring-2 ring-foreground/70 ring-offset-2 ring-offset-card" : "hover:scale-110",
          )}
        >
          <X className="size-3.5 text-muted-foreground" aria-hidden />
        </button>
      )}
    </div>
  );
}
