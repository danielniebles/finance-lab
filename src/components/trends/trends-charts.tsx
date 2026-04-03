"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MonthPoint } from "@/lib/queries/trends";

// ─── Shared tooltip style ─────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--foreground)",
};

function copFormatter(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

// ─── Income vs Expenses chart ─────────────────────────────────────────────────

export function IncomeExpensesChart({ data }: { data: MonthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barCategoryGap="30%" barGap={3}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={copFormatter}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(value: number) => copFormatter(value)}
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          formatter={(value) =>
            value === "income" ? "Income" : value === "expenses" ? "Expenses" : "Budget"
          }
        />
        <Bar dataKey="income" fill="#34d399" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" fill="#f87171" radius={[3, 3, 0, 0]} />
        <Bar dataKey="budget" fill="#60a5fa" radius={[3, 3, 0, 0]} opacity={0.6} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Savings rate chart ────────────────────────────────────────────────────────

export function SavingsRateChart({ data }: { data: MonthPoint[] }) {
  const chartData = data.map((d) => ({
    ...d,
    savingsRate: d.savingsRate !== null ? parseFloat(d.savingsRate.toFixed(1)) : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={40}
          domain={["auto", "auto"]}
        />
        <Tooltip
          formatter={(value: number) => [`${value}%`, "Savings Rate"]}
          contentStyle={TOOLTIP_STYLE}
        />
        <ReferenceLine
          y={20}
          stroke="#34d399"
          strokeDasharray="4 4"
          strokeOpacity={0.6}
          label={{ value: "Target 20%", position: "insideTopRight", fontSize: 10, fill: "#6b7280" }}
        />
        <Line
          type="monotone"
          dataKey="savingsRate"
          stroke="#a78bfa"
          strokeWidth={2}
          dot={{ r: 3, fill: "#a78bfa" }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
