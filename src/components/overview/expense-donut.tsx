"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCOP, formatShort } from "@/lib/format";
import { paletteColor } from "@/lib/chart-colors";

const TOOLTIP_STYLE = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "13px",
  color: "var(--foreground)",
};

type Slice = { name: string; value: number; color: string };

function buildSlices(data: { name: string; spent: number }[]): Slice[] {
  const MAX_SLICES = 8;
  const sorted = [...data]
    .filter((d) => d.spent > 0)
    .sort((a, b) => b.spent - a.spent);

  if (sorted.length <= MAX_SLICES) {
    return sorted.map((d, i) => ({
      name: d.name,
      value: d.spent,
      color: paletteColor(i),
    }));
  }

  const top = sorted.slice(0, MAX_SLICES - 1);
  const rest = sorted.slice(MAX_SLICES - 1);
  const otherTotal = rest.reduce((s, d) => s + d.spent, 0);

  return [
    ...top.map((d, i) => ({ name: d.name, value: d.spent, color: paletteColor(i) })),
    { name: `+${rest.length} more`, value: otherTotal, color: "oklch(0.55 0.02 250)" },
  ];
}

export function ExpenseDonut({
  categories,
  totalExpenses,
}: {
  categories: { name: string; spent: number }[];
  totalExpenses: number;
}) {
  const slices = buildSlices(categories);

  return (
    <div className="flex flex-row items-start gap-6">
      {/* Donut — fixed size, shrink-0 */}
      <div className="relative shrink-0 w-44 h-44">
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

      {/* Legend — two-row per item, right side */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 flex-1 min-w-0">
        {slices.map((slice) => {
          const pct = totalExpenses > 0 ? (slice.value / totalExpenses) * 100 : 0;
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
