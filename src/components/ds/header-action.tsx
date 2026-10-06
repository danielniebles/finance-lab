"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The page's primary action in a PageHeader: teal, 36px, a plus and a
 * verb + noun label. `shortLabel` replaces it on phones ("Add" for "Add
 * installment") where the title row is tight; the full label returns at `sm`.
 * Pass `href` for a link (Home → ledger) or `onClick` for a dialog.
 */
export function HeaderAction({
  label,
  shortLabel,
  href,
  onClick,
}: {
  label: string;
  shortLabel?: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <Plus aria-hidden />
      {shortLabel ? (
        <>
          <span className="sm:hidden">{shortLabel}</span>
          <span className="max-sm:hidden">{label}</span>
        </>
      ) : (
        label
      )}
    </>
  );
  if (href) {
    return (
      <Link href={href} aria-label={label} className={cn(buttonVariants({ size: "lg" }), "px-3.5")}>
        {content}
      </Link>
    );
  }
  return (
    <Button size="lg" className="px-3.5" onClick={onClick} aria-label={shortLabel ? label : undefined}>
      {content}
    </Button>
  );
}
