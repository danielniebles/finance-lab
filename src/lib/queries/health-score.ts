import { db } from "@/lib/db";
import { MONTH_NAMES } from "@/lib/format";
import { getMonthlyAnalysis } from "@/lib/queries/expenses";
import { getMonthSummary } from "@/lib/queries/installments";
import { getLoansOverview } from "@/lib/queries/loans";

export type HealthScoreTier = "Excellent" | "Good" | "Fair" | "At Risk";

export type HealthScoreMetric = {
  label: string;
  points: number;
  maxPoints: 25;
  rawValue: string;
  status: "good" | "warn" | "bad" | "na";
};

export type HealthScore = {
  score: number;
  tier: HealthScoreTier;
  monthLabel: string;
  metrics: HealthScoreMetric[];
};

function scorePoints(
  value: number | null,
  thresholds: { good: number; warn: number; ok: number; direction: "asc" | "desc" }
): { points: number; status: HealthScoreMetric["status"] } {
  if (value === null) return { points: 0, status: "na" };
  const { good, warn, ok, direction } = thresholds;
  const passes = (v: number, t: number) => direction === "asc" ? v >= t : v <= t;
  if (passes(value, good)) return { points: 25, status: "good" };
  if (passes(value, warn)) return { points: 15, status: "warn" };
  if (passes(value, ok)) return { points: 5, status: "bad" };
  return { points: 0, status: "bad" };
}

function fmt(value: number | null, suffix = "%"): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}${suffix}`;
}

export async function getHealthScore(): Promise<HealthScore | null> {
  const batch = await db.importBatch.findFirst({
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
  if (!batch) return null;

  const [analysis, monthSummary, loansOverview] = await Promise.all([
    getMonthlyAnalysis(batch.month, batch.year),
    getMonthSummary(batch.month, batch.year),
    getLoansOverview(),
  ]);

  const savingsScore = scorePoints(analysis.savingsRate, {
    good: 20, warn: 10, ok: 0, direction: "asc",
  });

  const burnScore = scorePoints(analysis.variableBurnRate, {
    good: 80, warn: 100, ok: 120, direction: "desc",
  });

  const burden =
    analysis.totalIncome > 0
      ? (monthSummary.totalObligation / analysis.totalIncome) * 100
      : null;
  const burdenScore = scorePoints(burden, {
    good: 10, warn: 20, ok: 30, direction: "desc",
  });

  const liquidityScore = scorePoints(loansOverview.liquidityRatio, {
    good: 70, warn: 50, ok: 30, direction: "asc",
  });

  const score =
    savingsScore.points +
    burnScore.points +
    burdenScore.points +
    liquidityScore.points;

  const tier: HealthScoreTier =
    score >= 85 ? "Excellent" :
    score >= 65 ? "Good" :
    score >= 45 ? "Fair" :
    "At Risk";

  const metrics: HealthScoreMetric[] = [
    {
      label: "Savings Rate",
      points: savingsScore.points,
      maxPoints: 25,
      rawValue: fmt(analysis.savingsRate),
      status: savingsScore.status,
    },
    {
      label: "Variable Burn Rate",
      points: burnScore.points,
      maxPoints: 25,
      rawValue: fmt(analysis.variableBurnRate),
      status: burnScore.status,
    },
    {
      label: "Installment Burden",
      points: burdenScore.points,
      maxPoints: 25,
      rawValue: fmt(burden),
      status: burdenScore.status,
    },
    {
      label: "Liquidity Ratio",
      points: liquidityScore.points,
      maxPoints: 25,
      rawValue: fmt(loansOverview.liquidityRatio),
      status: liquidityScore.status,
    },
  ];

  return {
    score,
    tier,
    monthLabel: `${MONTH_NAMES[batch.month - 1]} ${batch.year}`,
    metrics,
  };
}
