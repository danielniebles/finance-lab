"use client";

import { Checkbox } from "@/components/ui/checkbox";

/**
 * A yes/no option: checkbox, label and an optional hint underneath. The whole
 * row is the hit target (min 44px), so it's easy to tap on a phone.
 */
export function CheckField({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      data-slot="field"
      className="flex min-h-11 scroll-my-4 cursor-pointer items-start gap-3 rounded-lg py-1.5 has-disabled:cursor-not-allowed has-disabled:opacity-60"
    >
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} disabled={disabled} className="mt-0.5" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}
