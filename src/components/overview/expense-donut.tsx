"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCOP, formatShort } from "@/lib/format";
import { paletteColor } from "@/lib/chart-colors";
import { cn } from "@/lib/utils";
import type { CategorySeverity } from "@/lib/queries/expenses";

const TOOLTIP_STYLE = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "13px",
  color: "var(--foreground)",
};

type CategoryInput = {
  name: string;
  spent: number;
  percentUsed: number | null;
  severity: CategorySeverity;
  note: string | null;
};

type Slice = {
  name: string;
  value: number;
  color: string;
  percentUsed: number | null;
  severity: CategorySeverity | null; // null for the aggregated "+N more" slice — no single status
  note: string | null;
};

function buildSlices(data: CategoryInput[]): Slice[] {
  const MAX_SLICES = 8;
  const sorted = [...data]
    .filter((d) => d.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  if (sorted.length <= MAX_SLICES) {
    return sorted.map((d, i) => ({
      name: d.name,
      value: d.spent,
      color: paletteColor(i),
      percentUsed: d.percentUsed,
      severity: d.severity,
      note: d.note,
    }));
  }

  const top = sorted.slice(0, MAX_SLICES - 1);
  const rest = sorted.slice(MAX_SLICES - 1);
  const otherTotal = rest.reduce((s, d) => s + d.spent, 0);

  return [
    ...top.map((d, i) => ({
      name: d.name,
      value: d.spent,
      color: paletteColor(i),
      percentUsed: d.percentUsed,
      severity: d.severity,
      note: d.note,
    })),
    {
      name: `+${rest.length} more`,
      value: otherTotal,
      color: "oklch(0.55 0.02 250)",
      percentUsed: null,
      severity: null,
      note: null,
    },
  ];
}

// Per-row status flag — the merged "on track / X% over" summary that replaces
// the separate at-risk list (Overview redesign, req 4). Falls back to the
// category's classification note/severity for cases that don't reduce
// cleanly to a percentage (no budget at all, or an unpaid fixed bill).
function categoryStatusFlag(slice: Slice): { label: string; toneClass: string } | null {
  if (slice.severity === null) return null; // aggregated "+N more" — no single status
  if (slice.severity === "OK") return { label: "On track", toneClass: "text-success" };
  if (slice.percentUsed !== null && slice.percentUsed > 100) {
    return {
      label: `${Math.round(slice.percentUsed - 100)}% over`,
      toneClass: slice.severity === "Critical" ? "text-destructive" : "text-warning",
    };
  }
  return { label: slice.note ?? slice.severity, toneClass: "text-warning" };
}

export function ExpenseDonut({
  categories,
  totalExpenses,
}: {
  categories: CategoryInput[];
  totalExpenses: number;
}) {
  const slices = buildSlices(categories);

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
      {/* Donut — fixed size, shrink-0 */}
      <div className="relative shrink-0 w-44 h-44 mx-auto sm:mx-0">
        <ResponsiveContainer width="100%" height={176}>
          <PieChart>
            <Pie
              data={slices}
              cx="50%"
              cy="50%"
              innerRadius={54}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {slices.map((slice, i) => (
                <Cell key={i} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) =>
                typeof value === "number" ? formatCOP(value) : String(value)
              }
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "var(--muted-foreground)" }}
              itemStyle={{ color: "var(--foreground)" }}
              wrapperStyle={{ zIndex: 50 }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center: Total Spent */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-lg font-bold leading-none tabular-nums">
            {formatShort(totalExpenses)}
          </span>
          <span className="mt-1 text-xs text-muted-foreground uppercase tracking-wider">
            total spent
          </span>
        </div>
      </div>

      {/* Legend — per-category dollar list with an inline status flag */}
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 flex-1 min-w-0 sm:grid-cols-2">
        {slices.map((slice) => {
          const pct = totalExpenses > 0 ? (slice.value / totalExpenses) * 100 : 0;
          const flag = categoryStatusFlag(slice);
          return (
            <div key={slice.name} className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="truncate text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  {slice.name}
                </span>
              </div>
              <div className="flex items-baseline justify-between pl-4">
                <span className="font-mono text-sm tabular-nums text-foreground">
                  {formatCOP(slice.value)}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground ml-2">
                  {pct.toFixed(0)}%
                </span>
              </div>
              {flag && (
                <p className={cn("pl-4 text-[10px] font-medium uppercase tracking-wide", flag.toneClass)}>
                  {flag.label}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
