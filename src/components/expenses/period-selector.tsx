"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MONTH_NAMES } from "@/lib/format";
import { buildExpensesUrl, type ExpensesSearchParams } from "@/lib/build-expenses-url";

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
    d.toLocaleDateString("es-CO", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

type MonthEntry = { month: number; year: number; status?: string };

export function PeriodSelector({
  selectedMonth,
  selectedYear,
  startDay = 1,
  availableMonths,
  currentParams,
}: {
  selectedMonth: number;
  selectedYear: number;
  startDay?: number;
  availableMonths?: MonthEntry[];
  currentParams: ExpensesSearchParams;
}) {
  const router = useRouter();
  const current = currentFinancialMonth(startDay);
  const isCurrentMonth =
    selectedMonth === current.month && selectedYear === current.year;

  // Find prev/next within the imported months list when available.
  // When the selected month has no data (not in the list), find the nearest
  // available months on either side so navigation is never locked.
  let prevEntry: MonthEntry | null = null;
  let nextEntry: MonthEntry | null = null;

  if (availableMonths) {
    const currentIdx = availableMonths.findIndex(
      (m) => m.month === selectedMonth && m.year === selectedYear
    );
    if (currentIdx >= 0) {
      prevEntry = currentIdx > 0 ? availableMonths[currentIdx - 1] : null;
      nextEntry = currentIdx < availableMonths.length - 1 ? availableMonths[currentIdx + 1] : null;
    } else {
      // Selected month not in list — find nearest neighbours by ordinal
      const sel = selectedYear * 12 + selectedMonth;
      const before = availableMonths.filter((m) => m.year * 12 + m.month < sel);
      const after  = availableMonths.filter((m) => m.year * 12 + m.month > sel);
      prevEntry = before.length > 0 ? before[before.length - 1] : null;
      nextEntry = after.length  > 0 ? after[0] : null;
    }
  }

  // Preserve every other param (view, walletId, groupBy, category, type,
  // search) — changing month must never reset the current view/filters.
  function navigate(entry: MonthEntry) {
    router.push(
      buildExpensesUrl(currentParams, { month: String(entry.month), year: String(entry.year) }),
    );
  }

  function navigateDelta(delta: number) {
    let m = selectedMonth + delta;
    let y = selectedYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    router.push(buildExpensesUrl(currentParams, { month: String(m), year: String(y) }));
  }

  const hasPrev = availableMonths ? !!prevEntry : true;
  const hasNext = availableMonths ? !!nextEntry : true;

  const selectedEntry = availableMonths?.find(
    (m) => m.month === selectedMonth && m.year === selectedYear,
  );
  const isInProgress = selectedEntry?.status === "IN_PROGRESS";

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        disabled={!hasPrev}
        onClick={() => availableMonths && prevEntry ? navigate(prevEntry) : navigateDelta(-1)}
      >
        <ChevronLeft className="size-5" />
      </Button>

      <div className="text-center min-w-36">
        <div className="flex items-center justify-center gap-2">
          <span className="font-heading text-sm font-semibold">
            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </span>
          {isInProgress && (
            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              in progress
            </span>
          )}
        </div>
        {startDay > 1 && (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {periodRangeLabel(selectedMonth, selectedYear, startDay)}
          </div>
        )}
      </div>

      <Button
        variant="outline"
        size="icon"
        disabled={!hasNext}
        onClick={() => availableMonths && nextEntry ? navigate(nextEntry) : navigateDelta(1)}
      >
        <ChevronRight className="size-5" />
      </Button>

      {!isCurrentMonth && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() =>
            router.push(
              buildExpensesUrl(currentParams, { month: String(current.month), year: String(current.year) }),
            )
          }
        >
          Today
        </Button>
      )}
    </div>
  );
}
