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

/**
 * How far `now` is into the financial period `[start, end)`, in whole days.
 * Returns null when `now` falls outside the period (a past or future month),
 * i.e. when there is no "spend so far" to pace against.
 */
export function periodProgress(
  now: Date,
  start: Date,
  end: Date,
): { daysElapsed: number; daysInPeriod: number } | null {
  if (now < start || now >= end) return null;
  const DAY = 24 * 60 * 60 * 1000;
  const daysInPeriod = Math.round((end.getTime() - start.getTime()) / DAY);
  // Today counts as elapsed: on the period's first day, 1 of N days have passed.
  const daysElapsed = Math.min(daysInPeriod, Math.floor((now.getTime() - start.getTime()) / DAY) + 1);
  return { daysElapsed, daysInPeriod };
}

/**
 * Blend month-to-date variable spend with the historical prediction.
 *
 * `paced` extrapolates spend-so-far linearly to the end of the period. Early
 * in the month that's noisy (one big purchase on day 2 looks like a disaster),
 * so the weight on the paced number grows with the share of the period that
 * has elapsed: day 3/30 → 10% pace / 90% history; day 27/30 → 90% / 10%.
 * The result never drops below what's already been spent.
 */
export function blendPacedVariable(args: {
  spentSoFar: number;
  daysElapsed: number;
  daysInPeriod: number;
  predicted: number;
}): { paced: number; blended: number; weight: number } {
  const { spentSoFar, daysElapsed, daysInPeriod, predicted } = args;
  const weight = daysInPeriod > 0 ? Math.min(1, Math.max(0, daysElapsed / daysInPeriod)) : 0;
  const paced = daysElapsed > 0 ? spentSoFar * (daysInPeriod / daysElapsed) : spentSoFar;
  const blended = Math.max(spentSoFar, weight * paced + (1 - weight) * predicted);
  return { paced, blended, weight };
}
