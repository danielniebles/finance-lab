"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCOP } from "@/lib/format";
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
  savingsRate,
}: {
  categories: { name: string; spent: number }[];
  totalExpenses: number;
  savingsRate: number | null;
}) {
  const slices = buildSlices(categories);

  return (
    <div className="flex flex-col gap-5">
      {/* Donut — centred, full width */}
      <div className="relative mx-auto w-full max-w-[220px]">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={slices}
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={100}
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

        {/* Center: savings rate % — compact enough unlike COP amounts */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {savingsRate !== null ? (
            <>
              <span className="font-mono text-2xl font-bold leading-none tabular-nums">
                {savingsRate.toFixed(0)}%
              </span>
              <span className="mt-1 text-xs text-muted-foreground uppercase tracking-wider">
                saved
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </div>

      {/* Legend — two-column grid */}
      <div className="grid grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-6">
        {slices.map((slice) => {
          const pct = totalExpenses > 0 ? (slice.value / totalExpenses) * 100 : 0;
          return (
            <div key={slice.name} className="flex items-center gap-2.5 min-w-0">
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span className="flex-1 truncate text-sm text-muted-foreground">
                {slice.name}
              </span>
              <span className="font-mono text-sm tabular-nums text-foreground shrink-0">
                {formatCOP(slice.value)}
              </span>
              <span className="w-9 text-right font-mono text-xs tabular-nums text-muted-foreground shrink-0">
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
