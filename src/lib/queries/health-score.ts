import { MONTH_NAMES } from "@/lib/format";
import { financialMonthYear } from "@/lib/financial-period-utils";
import {
  HEALTH_RULES, metricValues, scoreMetric, tierFor, totalScore,
  type HealthInputs, type HealthScoreTier, type MetricKey, type MetricStatus,
} from "@/lib/health-score-utils";
import { getMonthlyAnalysis } from "@/lib/queries/expenses";
import { getMonthSummary } from "@/lib/queries/installments";
import { getLoansOverview } from "@/lib/queries/loans";
import { shiftMonth, type MonthKey } from "@/lib/trend-utils";

export type { HealthScoreTier } from "@/lib/health-score-utils";

export type HealthScoreMetric = {
  key: MetricKey;
  label: string;
  points: number;
  maxPoints: 25;
  /** Metric value in %, null when it can't be computed (e.g. no income). */
  value: number | null;
  rawValue: string;
  status: MetricStatus;
  target: string;
  targetValue: number;
  scaleMax: number;
};

export type HealthScore = {
  score: number;
  tier: HealthScoreTier;
  monthLabel: string;
  metrics: HealthScoreMetric[];
  scoreDelta: number | null; // vs previous month, null if no prior data
};

function fmt(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

async function inputsFor(m: MonthKey, liquidityRatio: number | null): Promise<HealthInputs & { hasData: boolean }> {
  const [analysis, summary] = await Promise.all([getMonthlyAnalysis(m.month, m.year), getMonthSummary(m.month, m.year)]);
  return {
    savingsRate: analysis.savingsRate,
    variableBurnRate: analysis.variableBurnRate,
    totalIncome: analysis.totalIncome,
    totalObligation: summary.totalObligation,
    liquidityRatio,
    hasData: analysis.totalIncome > 0 || analysis.totalExpenses > 0,
  };
}

/**
 * Health of the last COMPLETE financial month (the one before today's).
 * Previously it scored the latest FINAL MoneyLover import, which froze on
 * June once imports stopped. A running month isn't scored: half a month of
 * income vs spend says little. Liquidity is point-in-time (today) for both
 * the month and its comparison.
 */
export async function getHealthScore(now: Date = new Date()): Promise<HealthScore | null> {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const current = financialMonthYear(now, startDay);
  const month = shiftMonth(current, -1);
  const prev = shiftMonth(current, -2);

  const { liquidityRatio } = await getLoansOverview();
  const [inputs, prevInputs] = await Promise.all([inputsFor(month, liquidityRatio), inputsFor(prev, liquidityRatio)]);
  if (!inputs.hasData) return null;

  const values = metricValues(inputs);
  const metrics: HealthScoreMetric[] = (Object.keys(HEALTH_RULES) as MetricKey[]).map((key) => {
    const rule = HEALTH_RULES[key];
    const { points, status } = scoreMetric(values[key], rule);
    return {
      key,
      label: rule.label,
      points,
      maxPoints: 25,
      value: values[key],
      rawValue: fmt(values[key]),
      status,
      target: rule.target,
      targetValue: rule.good,
      scaleMax: rule.scaleMax,
    };
  });
  const score = metrics.reduce((s, m) => s + m.points, 0);

  return {
    score,
    tier: tierFor(score),
    monthLabel: `${MONTH_NAMES[month.month - 1]} ${month.year}`,
    metrics,
    scoreDelta: prevInputs.hasData ? score - totalScore(prevInputs) : null,
  };
}
