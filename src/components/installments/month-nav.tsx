"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MONTH_NAMES } from "@/lib/format";

export function MonthNav({
  month,
  year,
  basePath = "/installments",
}: {
  month: number;
  year: number;
  basePath?: string;
}) {
  const router = useRouter();

  function navigate(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    router.push(`${basePath}?month=${m}&year=${y}`);
  }

  return (
    // Stretches across the controls row on phones (PageHeader).
    <div className="flex items-center gap-2 max-sm:flex-1">
      <Button variant="outline" size="icon-lg" aria-label="Previous month" onClick={() => navigate(-1)}>
        <ChevronLeft className="size-5" />
      </Button>
      <span className="min-w-0 flex-1 text-center font-heading text-sm font-semibold sm:w-36 sm:flex-none">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <Button variant="outline" size="icon-lg" aria-label="Next month" onClick={() => navigate(1)}>
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}
