"use client";

import { ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string; leading?: React.ReactNode };

type Props = {
  id?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: SelectOption[];
  placeholder?: string;
  noneLabel?: string;
  ariaLabel?: string;
  invalid?: boolean;
  disabled?: boolean;
};

const NONE = "__none__";

function Display({ option, fallback }: { option?: SelectOption; fallback: string }) {
  if (!option) return <span className="truncate text-muted-foreground">{fallback}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      {option.leading}
      <span className="truncate">{option.label}</span>
    </span>
  );
}

/**
 * Dropdown for forms. Full width, and it always shows the chosen option's
 * label (with its icon or colour dot), never the stored value.
 *
 * Touch screens get the phone's own picker: an invisible native <select>
 * over the field. A positioned popup there fights the on-screen keyboard
 * (the page resizes as it closes and the popup jumps). Mouse/trackpad
 * screens get the styled base-ui dropdown. Chosen with CSS `pointer`
 * media queries, so there's no hydration flash.
 *
 * `noneLabel` adds an explicit "None" option that maps to `null`.
 */
export function OptionSelect(props: Props) {
  const { value, options, placeholder = "Choose…", noneLabel } = props;
  const selected = value ? options.find((o) => o.value === value) : undefined;
  const fallback = value === null && noneLabel ? noneLabel : placeholder;
  return (
    <>
      <div className="pointer-fine:hidden">
        <NativeSelect {...props} selected={selected} fallback={fallback} />
      </div>
      <div className="pointer-coarse:hidden">
        <PopupSelect {...props} selected={selected} fallback={fallback} />
      </div>
    </>
  );
}

function NativeSelect({
  id,
  value,
  onChange,
  options,
  noneLabel,
  ariaLabel,
  invalid,
  disabled,
  selected,
  fallback,
}: Props & { selected?: SelectOption; fallback: string }) {
  return (
    <div
      className={cn(
        "relative flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent pr-2 pl-3 text-base dark:bg-input/30",
        "has-[select:focus-visible]:border-ring has-[select:focus-visible]:ring-3 has-[select:focus-visible]:ring-ring/50",
        invalid && "border-destructive",
        disabled && "opacity-50",
      )}
    >
      <Display option={selected} fallback={fallback} />
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <select
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        value={value ?? NONE}
        onChange={(e) => onChange(e.target.value === NONE ? null : e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      >
        {(noneLabel || value === null) && (
          <option value={NONE} disabled={!noneLabel}>
            {noneLabel ?? fallback}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PopupSelect({
  id,
  value,
  onChange,
  options,
  noneLabel,
  ariaLabel,
  invalid,
  disabled,
  selected,
  fallback,
}: Props & { selected?: SelectOption; fallback: string }) {
  return (
    <Select value={value ?? null} onValueChange={(v) => onChange((v as string | null) ?? null)} disabled={disabled}>
      <SelectTrigger id={id ? `${id}-popup` : undefined} aria-label={ariaLabel} aria-invalid={invalid || undefined} className="w-full text-base md:text-sm">
        <SelectValue className="min-w-0">{() => <Display option={selected} fallback={fallback} />}</SelectValue>
      </SelectTrigger>
      {/* Opens below the field like a normal dropdown (no jump to overlap the
          trigger, which made it resize as it opened). */}
      <SelectContent alignItemWithTrigger={false}>
        {noneLabel && (
          <SelectItem value={null} className="py-1.5 text-muted-foreground">
            {noneLabel}
          </SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="py-1.5">
            {o.leading}
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
