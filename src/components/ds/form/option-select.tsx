"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SelectOption = { value: string; label: string; leading?: React.ReactNode };

/**
 * Dropdown for forms. Full width, and the trigger always shows the chosen
 * option's label (with its icon or colour dot), never the stored value:
 * base-ui's Select.Value prints the raw value ("1") unless it's told how to
 * render it, which is what made the old Cadence field show "1".
 *
 * `noneLabel` adds an explicit "None" option that maps to `null`.
 */
export function OptionSelect({
  id,
  value,
  onChange,
  options,
  placeholder = "Choose…",
  noneLabel,
  ariaLabel,
  invalid,
  disabled,
}: {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  noneLabel?: string;
  ariaLabel?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const byValue = new Map(options.map((o) => [o.value, o]));
  const render = (v: string | null) => {
    const o = v ? byValue.get(v) : undefined;
    if (!o) return <span className="text-muted-foreground">{v === null && noneLabel ? noneLabel : placeholder}</span>;
    return (
      <span className="flex min-w-0 items-center gap-2">
        {o.leading}
        <span className="truncate">{o.label}</span>
      </span>
    );
  };

  return (
    <Select
      value={value ?? null}
      onValueChange={(v) => onChange((v as string | null) ?? null)}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} aria-invalid={invalid || undefined} className="w-full text-base md:text-sm">
        <SelectValue className="min-w-0">{render}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {noneLabel && (
          <SelectItem value={null} className="py-2 text-muted-foreground sm:py-1.5">
            {noneLabel}
          </SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="py-2 sm:py-1.5">
            {o.leading}
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
