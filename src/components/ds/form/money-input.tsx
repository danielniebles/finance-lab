"use client";

import { digitsOnly, formatThousands } from "@/lib/form-format";
import { cn } from "@/lib/utils";

/**
 * Peso amount input. Holds a digit string ("1200000") and shows it with
 * separators ("$ 1.200.000") as you type, in the mono face <Money> uses.
 * `inputMode="numeric"` brings up the number keypad on phones.
 */
export function MoneyInput({
  id,
  value,
  onValueChange,
  size = "md",
  placeholder = "0",
  inputRef,
  invalid,
  className,
  ...rest
}: {
  id?: string;
  value: string;
  onValueChange: (digits: string) => void;
  size?: "md" | "lg";
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  invalid?: boolean;
  className?: string;
} & Pick<React.ComponentProps<"input">, "autoFocus" | "required" | "disabled" | "aria-label" | "name">) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-3 transition-colors dark:bg-input/30",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive ring-3 ring-destructive/20",
        size === "lg" ? "h-13" : "h-10",
        className,
      )}
    >
      <span aria-hidden className={cn("font-mono text-muted-foreground", size === "lg" ? "text-xl" : "text-sm")}>
        $
      </span>
      <input
        ref={inputRef}
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={formatThousands(value)}
        onChange={(e) => onValueChange(digitsOnly(e.target.value))}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        className={cn(
          "min-w-0 flex-1 bg-transparent font-mono tabular-nums outline-none placeholder:text-muted-foreground",
          size === "lg" ? "text-2xl font-medium" : "text-base md:text-sm",
        )}
        {...rest}
      />
    </div>
  );
}
