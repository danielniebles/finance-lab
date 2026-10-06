"use client";

import { useRef } from "react";
import { CalendarDays } from "lucide-react";
import { formatDateLabel, localISODate, shiftISODate } from "@/lib/form-format";
import { cn } from "@/lib/utils";

export type QuickPick = "today" | "yesterday" | { label: string; value: string };

function resolvePick(pick: QuickPick, today: string): { label: string; value: string } {
  if (pick === "today") return { label: "Today", value: today };
  if (pick === "yesterday") return { label: "Yesterday", value: shiftISODate(today, -1) };
  return pick;
}

/**
 * Date control: a button that reads "Today, Oct 6" / "Mar 12, 2027" in the
 * same format in every browser, opening the browser's own date picker
 * (`showPicker()`: calendar on desktop, wheel on phones). No date library.
 * Holds the same "YYYY-MM-DD" string the old `<input type="date">` did.
 */
export function DateField({
  id,
  value,
  onChange,
  quickPicks,
  placeholder = "Pick a date",
  ariaLabel,
  required,
  disabled,
  min,
  max,
}: {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  quickPicks?: QuickPick[];
  placeholder?: string;
  ariaLabel?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const today = localISODate(new Date());
  const label = formatDateLabel(value);

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      // Older browsers: focusing the (visually hidden) input still lets the
      // keyboard and the OS picker work.
      input.focus();
      input.click();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={openPicker}
          aria-label={ariaLabel ? `${ariaLabel}: ${label || placeholder}` : undefined}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-left text-base transition-colors outline-none md:text-sm dark:bg-input/30",
            "hover:bg-input/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
            !label && "text-muted-foreground",
          )}
        >
          {label || placeholder}
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
        <input
          ref={inputRef}
          type="date"
          tabIndex={-1}
          aria-hidden
          value={value}
          min={min}
          max={max}
          required={required}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          // Not display:none — showPicker() needs a rendered input. It sits
          // under the button, invisible, so the picker anchors to the field.
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
        />
      </div>
      {quickPicks && quickPicks.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quickPicks.map((p) => {
            const pick = resolvePick(p, today);
            const active = pick.value === value;
            return (
              <button
                key={pick.label}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() => onChange(pick.value)}
                className={cn(
                  "h-7 rounded-full border px-3 text-xs font-medium transition-colors",
                  active
                    ? "border-transparent bg-foreground/10 text-foreground"
                    : "border-dashed border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {pick.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
