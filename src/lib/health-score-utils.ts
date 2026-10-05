// Pure scoring rules for the Financial Health score — client-safe, no DB.
// Four metrics, 25 points each: full points at the target, 15 inside the
// "warn" band, 5 inside the "ok" band, 0 beyond it.

import type { Tone } from "@/lib/status";

export type HealthScoreTier = "Excellent" | "Good" | "Fair" | "At Risk";
export type MetricStatus = "good" | "warn" | "bad" | "na";
export type MetricKey = "savings" | "burn" | "burden" | "liquidity";

type Rule = {
  key: MetricKey;
  label: string;
  /** asc = higher is better; desc = lower is better. */
  direction: "asc" | "desc";
  good: number;
  warn: number;
  ok: number;
  /** Shown under the meter: what "full points" means. */
  target: string;
  /** Right edge of the meter scale, in %. */
  scaleMax: number;
};

export const HEALTH_RULES: Record<MetricKey, Rule> = {
  savings: { key: "savings", label: "Savings rate", direction: "asc", good: 20, warn: 10, ok: 0, target: "Target ≥ 20% of income", scaleMax: 40 },
  burn: { key: "burn", label: "Variable burn", direction: "desc", good: 80, warn: 100, ok: 120, target: "Target ≤ 80% of variable budget", scaleMax: 150 },
  burden: { key: "burden", label: "Installment burden", direction: "desc", good: 10, warn: 20, ok: 30, target: "Target ≤ 10% of income", scaleMax: 40 },
  liquidity: { key: "liquidity", label: "Liquidity", direction: "asc", good: 70, warn: 50, ok: 30, target: "Target ≥ 70% available", scaleMax: 100 },
};

export function scoreMetric(value: number | null, rule: Pick<Rule, "direction" | "good" | "warn" | "ok">): { points: number; status: MetricStatus } {
  if (value === null) return { points: 0, status: "na" };
  const passes = (t: number) => (rule.direction === "asc" ? value >= t : value <= t);
  if (passes(rule.good)) return { points: 25, status: "good" };
  if (passes(rule.warn)) return { points: 15, status: "warn" };
  if (passes(rule.ok)) return { points: 5, status: "bad" };
  return { points: 0, status: "bad" };
}

export function tierFor(score: number): HealthScoreTier {
  if (score >= 85) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 45) return "Fair";
  return "At Risk";
}

export function toneForTier(tier: HealthScoreTier): Tone {
  switch (tier) {
    case "Excellent":
    case "Good":
      return "positive";
    case "Fair":
      return "caution";
    case "At Risk":
      return "danger";
  }
}

export function toneForMetricStatus(status: MetricStatus): Tone {
  switch (status) {
    case "good":
      return "positive";
    case "warn":
      return "caution";
    case "bad":
      return "danger";
    case "na":
      return "neutral";
  }
}

export type HealthInputs = {
  savingsRate: number | null;
  variableBurnRate: number | null;
  totalIncome: number;
  totalObligation: number;
  liquidityRatio: number | null;
};

/** Metric values in %, keyed like HEALTH_RULES. Burden needs income to exist. */
export function metricValues(i: HealthInputs): Record<MetricKey, number | null> {
  return {
    savings: i.savingsRate,
    burn: i.variableBurnRate,
    burden: i.totalIncome > 0 ? (i.totalObligation / i.totalIncome) * 100 : null,
    liquidity: i.liquidityRatio,
  };
}

export function totalScore(i: HealthInputs): number {
  const values = metricValues(i);
  return (Object.keys(HEALTH_RULES) as MetricKey[]).reduce(
    (s, k) => s + scoreMetric(values[k], HEALTH_RULES[k]).points,
    0,
  );
}
