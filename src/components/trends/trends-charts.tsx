"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCOP } from "@/lib/format";
import { TONE_CLASSES } from "@/lib/status";
import { signedCompact } from "@/lib/trend-utils";

export type ChartMonth = {
  key: string; // "10-2026" — unique even when a 12-month window repeats a month name
  label: string; // "Oct"
  income: number;
  expenses: number;
  net: number;
  inProgress: boolean;
};

// Series colours, never status colours (DESIGN.md). Passed via CSS vars so
// every theme block in globals.css applies.
export const INCOME_COLOR = "var(--chart-1)";
export const SPENDING_COLOR = "var(--chart-2)";

const TICK = { fontSize: 11, style: { fill: "var(--muted-foreground)" } };

function axisMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${Math.round(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `$${Math.round(abs / 1_000)}k`;
  return `$${abs}`;
}

/** X tick: month name, and the month's net (income − spending) under it. */
type TickMode = { soFar: boolean; net: boolean; small: boolean };

function MonthTick({ x, y, payload, data, mode }: { x?: number; y?: number; payload?: { index: number }; data: ChartMonth[]; mode: TickMode }) {
  const m = payload ? data[payload.index] : undefined;
  if (!m || x === undefined || y === undefined) return null;
  const netColor = m.inProgress ? "var(--muted-foreground)" : TONE_CLASSES[m.net >= 0 ? "positive" : "danger"].color;
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" dy={12} fontSize={11} style={{ fill: "var(--muted-foreground)" }}>
        {m.inProgress && mode.soFar ? `${m.label} · so far` : m.label}
      </text>
      {mode.net && (
        <text textAnchor="middle" dy={28} fontSize={mode.small ? 9.5 : 11} fontFamily="var(--font-mono)" fontWeight={600} style={{ fill: netColor }}>
          {signedCompact(m.net)}
        </text>
      )}
    </g>
  );
}

function TooltipBody({ active, payload }: { active?: boolean; payload?: { payload: ChartMonth }[] }) {
  const m = active ? payload?.[0]?.payload : undefined;
  if (!m) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium">{m.inProgress ? `${m.label} — so far` : m.label}</p>
      <p className="flex justify-between gap-4"><span className="text-muted-foreground">Income</span><span className="font-mono">{formatCOP(m.income)}</span></p>
      <p className="flex justify-between gap-4"><span className="text-muted-foreground">Spending</span><span className="font-mono">{formatCOP(m.expenses)}</span></p>
      <p className="flex justify-between gap-4"><span className="text-muted-foreground">Net</span><span className="font-mono">{formatCOP(m.net)}</span></p>
    </div>
  );
}

/**
 * Income and spending side by side per month, the monthly budget as a dashed
 * line, and each month's net under its label. The running month is drawn as
 * a draft (faded, dashed outline, shaded band) because it's still partial.
 */
export function IncomeSpendingChart({ data, budget }: { data: ChartMonth[]; budget: number }) {
  const running = data.find((m) => m.inProgress);
  // Room per month decides what fits under each bar group: "· so far" needs
  // ~90px, the net figure ~34px (smaller type under 56px). On phones a
  // 12-month window drops the net row; the tooltip still has it.
  const [width, setWidth] = useState(0);
  const perMonth = width > 0 ? (width - 44) / data.length : 100;
  const mode: TickMode = { soFar: perMonth >= 90, net: perMonth >= 34, small: perMonth < 56 };
  const draft = (m: ChartMonth) =>
    m.inProgress ? { fillOpacity: 0.35, stroke: "currentColor", strokeDasharray: "3 3", strokeOpacity: 0.5 } : {};

  return (
    <div className="h-72 text-muted-foreground">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} onResize={(w) => setWidth(w)}>
        <BarChart data={data} barCategoryGap="28%" barGap={4} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
          {running && <ReferenceArea x1={running.key} x2={running.key} fill="var(--muted)" fillOpacity={0.35} ifOverflow="extendDomain" />}
          <XAxis dataKey="key" axisLine={false} tickLine={false} height={mode.net ? 40 : 24} interval={0} tick={<MonthTick data={data} mode={mode} />} />
          <YAxis tickFormatter={axisMoney} tick={TICK} axisLine={false} tickLine={false} width={44} />
          <Tooltip content={<TooltipBody />} cursor={{ fill: "var(--muted)", opacity: 0.25 }} />
          {budget > 0 && <ReferenceLine y={budget} stroke="var(--muted-foreground)" strokeDasharray="5 4" strokeOpacity={0.8} />}
          <Bar dataKey="income" name="Income" fill={INCOME_COLOR} radius={[3, 3, 0, 0]}>
            {data.map((m) => <Cell key={m.key} {...draft(m)} />)}
          </Bar>
          <Bar dataKey="expenses" name="Spending" fill={SPENDING_COLOR} radius={[3, 3, 0, 0]}>
            {data.map((m) => <Cell key={m.key} {...draft(m)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
