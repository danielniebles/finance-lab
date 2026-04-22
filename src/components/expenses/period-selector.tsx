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

type MonthEntry = { month: number; year: number };

export function PeriodSelector({
  selectedMonth,
  selectedYear,
  startDay = 1,
  availableMonths,
}: {
  selectedMonth: number;
  selectedYear: number;
  startDay?: number;
  availableMonths?: MonthEntry[];
}) {
  const router = useRouter();
  const current = currentFinancialMonth(startDay);
  const isCurrentMonth =
    selectedMonth === current.month && selectedYear === current.year;

  // Find prev/next within the imported months list when available
  const currentIdx = availableMonths?.findIndex(
    (m) => m.month === selectedMonth && m.year === selectedYear
  ) ?? -1;

  const prevEntry = availableMonths && currentIdx > 0
    ? availableMonths[currentIdx - 1]
    : null;

  const nextEntry = availableMonths && currentIdx !== -1 && currentIdx < availableMonths.length - 1
    ? availableMonths[currentIdx + 1]
    : null;

  function navigate(entry: MonthEntry) {
    router.push(`/expenses?month=${entry.month}&year=${entry.year}`);
  }

  function navigateDelta(delta: number) {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    router.push(`/expenses?month=${m}&year=${y}`);
  }

  const hasPrev = availableMonths ? !!prevEntry : true;
  const hasNext = availableMonths ? !!nextEntry : true;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        disabled={!hasPrev}
        onClick={() => availableMonths && prevEntry ? navigate(prevEntry) : navigateDelta(-1)}
      >
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

      <Button
        variant="outline"
        size="icon"
        disabled={!hasNext}
        onClick={() => availableMonths && nextEntry ? navigate(nextEntry) : navigateDelta(1)}
      >
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
