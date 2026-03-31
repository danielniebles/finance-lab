"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTH_NAMES } from "@/lib/format";

type Batch = { month: number; year: number };

/**
 * Returns a short date label like "Feb 25 – Mar 24" for financial periods
 * that don't start on the 1st.
 */
function periodRangeLabel(month: number, year: number, startDay: number): string {
  // Period start: previous month, day startDay
  const start = new Date(year, month - 2, startDay); // JS handles month=-1 → Dec
  // Period end: this month, day startDay - 1
  const end = new Date(year, month - 1, startDay - 1);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return `${fmt(start)} – ${fmt(end)}`;
}

export function PeriodSelector({
  batches,
  selectedMonth,
  selectedYear,
  startDay = 1,
}: {
  batches: Batch[];
  selectedMonth: number;
  selectedYear: number;
  startDay?: number;
}) {
  const router = useRouter();

  function handleChange(value: string | null) {
    if (!value) return;
    const [month, year] = value.split("-");
    router.push(`/expenses?month=${month}&year=${year}`);
  }

  function batchLabel(b: Batch): string {
    const base = `${MONTH_NAMES[b.month - 1]} ${b.year}`;
    if (startDay <= 1) return base;
    return `${base} · ${periodRangeLabel(b.month, b.year, startDay)}`;
  }

  return (
    <Select
      value={`${selectedMonth}-${selectedYear}`}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {batches.map((b) => (
          <SelectItem key={`${b.month}-${b.year}`} value={`${b.month}-${b.year}`}>
            {batchLabel(b)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
