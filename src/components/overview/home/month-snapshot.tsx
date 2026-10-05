import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Meter, Money } from "@/components/ds";
import { SAVINGS_RATE_TARGET, TONE_CLASSES, toneForBudgetUsed, toneForSavingsRate } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Panel, ReadingGrid } from "./panel";

export type MonthSnapshotData = {
  monthLabel: string;
  daysElapsed: number | null;
  daysInPeriod: number | null;
  totalIncome: number;
  totalExpenses: number;
  totalBudget: number;
  realSavings: number;
  savingsRate: number | null;
  variableBurnRate: number | null;
  fixedActual: number;
  fixedBudget: number;
};

function Pct({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("font-mono font-semibold tabular-nums", TONE_CLASSES[toneForBudgetUsed(value)].text)}>
      {value.toFixed(0)}%
    </span>
  );
}

export function MonthSnapshot({ data }: { data: MonthSnapshotData }) {
  const rateTone = toneForSavingsRate(data.savingsRate);
  const fixedUsed = data.fixedBudget > 0 ? (data.fixedActual / data.fixedBudget) * 100 : null;
  const meterMax = SAVINGS_RATE_TARGET * 2;
  const dayLabel =
    data.daysElapsed !== null ? `day ${data.daysElapsed} of ${data.daysInPeriod}` : data.monthLabel;

  return (
    <Panel className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground font-sans">This month · {dayLabel}</h2>
        <Link
          href="/expenses?view=analysis"
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Full analysis
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex items-baseline gap-2.5">
            <span className={cn("font-mono text-4xl font-semibold leading-none tabular-nums max-sm:text-3xl", TONE_CLASSES[rateTone].text)}>
              {data.savingsRate !== null ? `${data.savingsRate.toFixed(1)}%` : "—"}
            </span>
            <span className="text-sm text-muted-foreground">saved so far</span>
          </span>
          <span className="text-xs text-muted-foreground">
            target <span className="font-mono text-foreground">{SAVINGS_RATE_TARGET}%</span>
          </span>
        </div>
        <Meter
          label="Savings rate against target"
          value={Math.max(0, data.savingsRate ?? 0)}
          max={meterMax}
          target={SAVINGS_RATE_TARGET}
          tone={rateTone}
        />
        <span className="text-xs text-muted-foreground">
          <Money value={data.realSavings} /> saved · marker shows the {SAVINGS_RATE_TARGET}% target
        </span>
      </div>

      <ReadingGrid
        items={[
          { label: "Income", value: <Money value={data.totalIncome} /> },
          { label: "Spent", value: <Money value={data.totalExpenses} /> },
          { label: "Budget", value: <Money value={data.totalBudget} /> },
        ]}
      />

      <p className="text-sm text-muted-foreground">
        Variable burn <Pct value={data.variableBurnRate} /> · fixed <Pct value={fixedUsed} />
      </p>
    </Panel>
  );
}
