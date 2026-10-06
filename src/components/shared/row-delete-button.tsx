"use client";

import { useEffect, useState } from "react";
import { Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Delete button for a row in a log. The first tap arms it ("Delete?"), the
 * second deletes; it disarms after a few seconds or when focus leaves. A
 * stray tap on a phone no longer deletes a record.
 */
export function RowDeleteButton({
  label,
  onDelete,
  disabled,
  className,
}: {
  /** What's being deleted, for screen readers ("Delete payment"). */
  label: string;
  onDelete: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  if (armed) {
    return (
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="h-7 shrink-0 px-2.5 text-xs"
        autoFocus
        onBlur={() => setArmed(false)}
        onClick={() => {
          setArmed(false);
          onDelete();
        }}
        disabled={disabled}
      >
        Delete?
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      className={cn("size-7 shrink-0 text-muted-foreground hover:text-destructive", className)}
      onClick={() => setArmed(true)}
      disabled={disabled}
    >
      <Trash className="size-3.5" />
    </Button>
  );
}
