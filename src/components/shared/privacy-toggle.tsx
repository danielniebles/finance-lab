"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Privacy mode toggle for a PageHeader's controls: labelled from `sm` up, an
 * icon button on phones (where the month navigation takes the row).
 */
export function PrivacyToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Button
      variant="outline"
      size="lg"
      className={cn("gap-1.5 max-sm:order-last max-sm:w-9 max-sm:px-0", on && "border-primary/50 text-primary")}
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? "Exit privacy mode" : "Enter privacy mode"}
      title={on ? "Exit privacy mode" : "Enter privacy mode"}
    >
      {on ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      <span className="max-sm:hidden">Privacy</span>
    </Button>
  );
}
