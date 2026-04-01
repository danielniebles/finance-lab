"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MONTH_NAMES } from "@/lib/format";

function currentFinancialMonth(startDay: number): { month: number; year: number } {
  const today = new Date();
  const day = today.getDate();
  let month = today.getMonth() + 1;
  let year = today.getFullYear();
  if (day >= startDay) {
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return { month, year };
}

function periodRangeLabel(month: number, year: number, startDay: number): string {
  const start = new Date(year, month - 2, startDay);
  const end = new Date(year, month - 1, startDay - 1);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function PeriodSelector({
  selectedMonth,
  selectedYear,
  startDay = 1,
}: {
  selectedMonth: number;
  selectedYear: number;
  startDay?: number;
}) {
  const router = useRouter();
  const current = currentFinancialMonth(startDay);
  const isCurrentMonth =
    selectedMonth === current.month && selectedYear === current.year;

  function navigate(delta: number) {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    router.push(`/expenses?month=${m}&year=${y}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
        <ChevronLeft className="size-4" />
      </Button>

      <div className="text-center min-w-36">
        <span className="font-heading text-sm font-semibold">
          {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
        </span>
        {startDay > 1 && (
          <span className="ml-2 text-xs text-muted-foreground">
            {periodRangeLabel(selectedMonth, selectedYear, startDay)}
          </span>
        )}
      </div>

      <Button variant="outline" size="icon" onClick={() => navigate(1)}>
        <ChevronRight className="size-4" />
      </Button>

      {!isCurrentMonth && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() =>
            router.push(`/expenses?month=${current.month}&year=${current.year}`)
          }
        >
          Today
        </Button>
      )}
    </div>
  );
}
