"use client";

import { CalendarDays, X } from "lucide-react";
import { formatDateLabel, localISODate, shiftISODate } from "@/lib/form-format";
import { cn } from "@/lib/utils";

export type QuickPick = "today" | "yesterday" | { label: string; value: string };

function resolvePick(pick: QuickPick, today: string): { label: string; value: string } {
  if (pick === "today") return { label: "Today", value: today };
  if (pick === "yesterday") return { label: "Yesterday", value: shiftISODate(today, -1) };
  return pick;
}

/**
 * Date control. Shows "Today, Oct 6" / "Mar 12, 2027" the same way in every
 * browser, but the thing you tap is the browser's own date input, laid
 * invisibly over the field: phones open their native date picker directly
 * (iOS ignores scripted `showPicker()`), and on desktop a click also calls
 * `showPicker()` so the calendar opens wherever you click, not only on the
 * icon. No date library. Holds the same "YYYY-MM-DD" string as before.
 *
 * `clearable` (optional dates) adds an × that sets the value back to "".
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
  clearable = false,
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
  clearable?: boolean;
}) {
  const label = formatDateLabel(value);
  const showClear = canClear(clearable, value, disabled);

  function openPicker(e: React.MouseEvent<HTMLInputElement>) {
    try {
      e.currentTarget.showPicker();
    } catch {
      // Already open, or not supported: the native input handles the tap itself.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "relative flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-base transition-colors md:text-sm dark:bg-input/30",
          "hover:bg-input/50 has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span aria-hidden className={cn("truncate", !label && "text-muted-foreground")}>
          {label || placeholder}
        </span>
        {!showClear && <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        <input
          id={id}
          type="date"
          aria-label={ariaLabel}
          value={value}
          min={min}
          max={max}
          required={required}
          disabled={disabled}
          onClick={openPicker}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          // Covers the whole field, invisible. Not display:none: it has to
          // receive the tap and stay focusable for keyboards.
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
        />
        {showClear && <ClearButton onClear={() => onChange("")} />}
      </div>
      {quickPicks && quickPicks.length > 0 && <QuickPicks picks={quickPicks} value={value} onChange={onChange} disabled={disabled} />}
    </div>
  );
}

function QuickPicks({
  picks,
  value,
  onChange,
  disabled,
}: {
  picks: QuickPick[];
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
}) {
  const today = localISODate(new Date());
  return (
    <div className="flex flex-wrap gap-1.5">
      {picks.map((p) => {
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
              "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
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
  );
}

function canClear(clearable: boolean, value: string, disabled?: boolean): boolean {
  return clearable && !!value && !disabled;
}

/** Above the invisible input, so the tap clears instead of opening the picker. */
function ClearButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      aria-label="Clear date"
      onClick={onClear}
      className="relative z-10 -mr-2 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
    >
      <X className="size-4" />
    </button>
  );
}
