"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCOP } from "@/lib/format";
import type { PacePoint } from "@/lib/spending-pace-display";

// Series colours, never status colours (DESIGN.md).
export const CURRENT_COLOR = "var(--chart-2)";
export const PREVIOUS_COLOR = "var(--muted-foreground)";

const TICK = { fontSize: 11, style: { fill: "var(--muted-foreground)" } };

// One decimal when needed: Recharts' nice ticks land on 3.5M, 10.5M…
function axisMoney(value: number): string {
  const short = (n: number) => String(Math.round(n * 10) / 10);
  if (value >= 1_000_000) return `$${short(value / 1_000_000)}M`;
  if (value >= 1_000) return `$${short(value / 1_000)}k`;
  return `$${value}`;
}

function TooltipBody({ active, payload }: { active?: boolean; payload?: { payload: PacePoint }[] }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  const previous = p.previousSoFar ?? p.previousRest;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-medium">Day {p.day}</p>
      {p.current !== null && (
        <p className="flex justify-between gap-4"><span className="text-muted-foreground">This period</span><span className="font-mono">{formatCOP(p.current)}</span></p>
      )}
      {previous !== null && (
        <p className="flex justify-between gap-4"><span className="text-muted-foreground">Last period</span><span className="font-mono">{formatCOP(previous)}</span></p>
      )}
    </div>
  );
}

/**
 * Cumulative spending day by day: this period up to today, last period solid
 * up to the same day and dashed after it, today marked.
 */
export function PaceChart({ points, today }: { points: PacePoint[]; today: number }) {
  return (
    <div className="h-56 w-full sm:h-64" role="img" aria-label={`Cumulative spending by day, this period against last period, up to day ${today}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 22, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis dataKey="day" tick={TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={TICK} tickLine={false} axisLine={false} width={44} tickFormatter={axisMoney} />
          <Tooltip content={<TooltipBody />} cursor={{ stroke: "var(--border)" }} />
          <ReferenceLine
            x={today}
            stroke="var(--muted-foreground)"
            strokeDasharray="3 4"
            label={{ value: `Today · day ${today}`, position: "top", fontSize: 11, fill: "var(--foreground)" }}
          />
          <Line dataKey="previousRest" stroke={PREVIOUS_COLOR} strokeOpacity={0.5} strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={false} isAnimationActive={false} />
          <Line dataKey="previousSoFar" stroke={PREVIOUS_COLOR} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          <Line dataKey="current" stroke={CURRENT_COLOR} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
