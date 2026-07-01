// Pure math utilities for the Forecasting module — client-safe, no DB imports.
// Mirror of vault-utils.ts pattern.

export const MIN_MONTHS = 3;

export type Prediction = {
  expected: number;
  low: number;
  high: number;
  confidence: "high" | "low";
};

/**
 * Predict a category's month-end landing from its past monthly spend amounts.
 * Nulls mean no import data existed for that month.
 *
 * Algorithm:
 *   - Filter out nulls; require >= MIN_MONTHS non-null points.
 *   - Expected: recency-weighted mean (weights 1,2,...n oldest→newest).
 *   - Band: ±1 population std dev of the unweighted history.
 *   - Confidence: "high" when std dev < 25% of mean (tight history), else "low".
 *
 * Returns null when fewer than MIN_MONTHS non-null values exist.
 */
export function predictCategoryLanding(
  history: (number | null)[],
): Prediction | null {
  const points = history.filter((v): v is number => v !== null);
  if (points.length < MIN_MONTHS) return null;

  const n = points.length;

  // Recency-weighted mean: weight[i] = i+1 (oldest=1, newest=n)
  const totalWeight = (n * (n + 1)) / 2;
  const expected = points.reduce((acc, v, i) => acc + v * (i + 1), 0) / totalWeight;

  // Unweighted std dev (population) for the band
  const mean = points.reduce((s, v) => s + v, 0) / n;
  const variance = points.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  const low = Math.max(0, expected - stdDev);
  const high = expected + stdDev;

  // "high" confidence when history is tight (std dev < 25% of mean)
  const confidence: "high" | "low" =
    mean > 0 && stdDev / mean < 0.25 ? "high" : "low";

  return { expected, low, high, confidence };
}

/**
 * Project the month-end savings rate from budget inputs.
 * Returns (income - (fixed + variable)) / income * 100, or null when income = 0.
 */
export function projectSavingsRate(args: {
  expectedIncome: number;
  fixedBudget: number;
  predictedVariable: number;
}): number | null {
  const { expectedIncome, fixedBudget, predictedVariable } = args;
  if (expectedIncome === 0) return null;
  return ((expectedIncome - (fixedBudget + predictedVariable)) / expectedIncome) * 100;
}
