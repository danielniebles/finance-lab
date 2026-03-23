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
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
        <ChevronLeft className="size-4" />
      </Button>
      <span className="w-36 text-center font-heading text-sm font-semibold">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <Button variant="outline" size="icon" onClick={() => navigate(1)}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
