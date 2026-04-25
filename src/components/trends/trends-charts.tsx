"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MonthPoint } from "@/lib/queries/trends";

// ─── Shared styles ────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--foreground)",
};

// Recharts doesn't inherit contentStyle color onto label/item text — set explicitly.
const TOOLTIP_LABEL_STYLE = { color: "var(--muted-foreground)" };
const TOOLTIP_ITEM_STYLE  = { color: "var(--foreground)" };

// Tick style passed via `style` so CSS custom properties resolve correctly.
// Passing fill as a bare SVG attribute breaks in dark mode because the CSS
// variables contain oklch() values — hsl(oklch(...)) is invalid CSS.
const TICK_STYLE = { fontSize: 11, style: { fill: "var(--muted-foreground)" } };

const GRID_STYLE = { stroke: "var(--border)", strokeOpacity: 0.4 };

function copFormatter(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs}`;
}

// ─── Income vs Expenses chart ─────────────────────────────────────────────────

export function IncomeExpensesChart({ data }: { data: MonthPoint[] }) {
  const budget = data[0]?.budget ?? 0;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barCategoryGap="30%" barGap={3}>
        <CartesianGrid vertical={false} {...GRID_STYLE} />
        <XAxis
          dataKey="label"
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={copFormatter}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(value) => typeof value === "number" ? copFormatter(value) : String(value)}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          cursor={{ fill: "var(--muted)", opacity: 0.3 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 12, color: "var(--muted-foreground)" }}
          formatter={(value) => value === "income" ? "Income" : "Expenses"}
        />
        {budget > 0 && (
          <ReferenceLine
            y={budget}
            stroke="var(--chart-2)"
            strokeDasharray="4 4"
            strokeOpacity={0.7}
            label={{
              value: `Budget ${copFormatter(budget)}`,
              position: "insideTopRight",
              fontSize: 10,
              style: { fill: "var(--muted-foreground)" },
            }}
          />
        )}
        <Bar dataKey="income" fill="var(--success)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" fill="var(--destructive)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Net balance chart ────────────────────────────────────────────────────────

export function NetBalanceChart({ data }: { data: MonthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barCategoryGap="40%">
        <CartesianGrid vertical={false} {...GRID_STYLE} />
        <XAxis
          dataKey="label"
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={copFormatter}
          tick={TICK_STYLE}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(value) =>
            typeof value === "number"
              ? [copFormatter(value), value >= 0 ? "Surplus" : "Deficit"]
              : [String(value), "Net"]
          }
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          cursor={{ fill: "var(--muted)", opacity: 0.3 }}
        />
        <ReferenceLine y={0} stroke="var(--border)" strokeOpacity={0.8} />
        <Bar dataKey="net" radius={[3, 3, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.net >= 0 ? "var(--success)" : "var(--destructive)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
