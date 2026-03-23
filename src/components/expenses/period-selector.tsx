"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTH_NAMES } from "@/lib/format";

type Batch = { month: number; year: number };

export function PeriodSelector({
  batches,
  selectedMonth,
  selectedYear,
}: {
  batches: Batch[];
  selectedMonth: number;
  selectedYear: number;
}) {
  const router = useRouter();

  function handleChange(value: string | null) {
    if (!value) return;
    const [month, year] = value.split("-");
    router.push(`/expenses?month=${month}&year=${year}`);
  }

  return (
    <Select
      value={`${selectedMonth}-${selectedYear}`}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {batches.map((b) => (
          <SelectItem key={`${b.month}-${b.year}`} value={`${b.month}-${b.year}`}>
            {MONTH_NAMES[b.month - 1]} {b.year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
