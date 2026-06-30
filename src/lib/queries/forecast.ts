// HISTORICAL projection — reads only past import batches, never current-month actuals.
// Phase B (getIncomePlan) is not yet shipped; expectedIncome falls back to trailing
// income average from getTrends. See ADR-019.

import { getTrends } from "@/lib/queries/trends";
import { getMonthlyAnalysis } from "@/lib/queries/expenses";
import {
  MIN_MONTHS,
  predictCategoryLanding,
  projectSavingsRate,
} from "@/lib/forecast-utils";
import type { Prediction } from "@/lib/forecast-utils";

export type { Prediction };

export type CategoryForecast = {
  id: string;
  name: string;
  budget: number;
  prediction: Prediction | null;
  willOverspend: boolean;
  overByExpected: number;
};

export type ForecastResult = {
  perCategory: CategoryForecast[];
  predictedVariableTotal: number;
  fixedBudget: number;
  expectedIncome: number;
  projectedSavingsRate: number | null;
  savingsRateTarget: number; // always 20
  vsTarget: number | null;
  vsLastMonth: number | null;
  drivers: CategoryForecast[];
  dataSufficiency: "ok" | "thin";
};

export async function getForecast(
  month: number,
  year: number,
): Promise<ForecastResult> {
  // Fetch trend history and current-month budget structure in parallel
  const [trends, analysis] = await Promise.all([
    getTrends(6),
    getMonthlyAnalysis(month, year),
  ]);

  // ── Expected income: trailing average from trends (Phase B fallback) ─────────
  const incomePoints = trends.months
    .map((m) => m.income)
    .filter((v) => v > 0);
  const expectedIncome =
    incomePoints.length > 0
      ? incomePoints.reduce((s, v) => s + v, 0) / incomePoints.length
      : 0;

  // ── Fixed budget from getMonthlyAnalysis ─────────────────────────────────────
  const { fixedBudget, categoryBreakdown } = analysis;

  // ── Variable categories (budgetType !== "FIXED") ─────────────────────────────
  const variableCategories = categoryBreakdown.filter(
    (c) => c.budgetType !== "FIXED",
  );

  // ── Per-category forecast ─────────────────────────────────────────────────────
  const perCategory: CategoryForecast[] = variableCategories.map((cat) => {
    // Find the matching categoryTrends row by id
    const trendRow = trends.categoryTrends.find((r) => r.id === cat.id);
    const history = trendRow ? trendRow.months : [];
    const prediction = predictCategoryLanding(history);

    const willOverspend = prediction !== null && prediction.expected > cat.budget;
    const overByExpected =
      prediction !== null ? Math.max(0, prediction.expected - cat.budget) : 0;

    return {
      id: cat.id,
      name: cat.name,
      budget: cat.budget,
      prediction,
      willOverspend,
      overByExpected,
    };
  });

  // ── Predicted variable total (sum of expected values, or budget as fallback) ──
  const predictedVariableTotal = perCategory.reduce((sum, c) => {
    return sum + (c.prediction?.expected ?? c.budget);
  }, 0);

  // ── Projected savings rate ────────────────────────────────────────────────────
  const projectedSavingsRate = projectSavingsRate({
    expectedIncome,
    fixedBudget,
    predictedVariable: predictedVariableTotal,
  });

  const savingsRateTarget = 20;
  const vsTarget =
    projectedSavingsRate !== null
      ? projectedSavingsRate - savingsRateTarget
      : null;

  // ── vs last month actual savings rate ────────────────────────────────────────
  const lastMonthRate =
    trends.months.length > 0
      ? trends.months[trends.months.length - 1].savingsRate
      : null;
  const vsLastMonth =
    projectedSavingsRate !== null && lastMonthRate !== null
      ? projectedSavingsRate - lastMonthRate
      : null;

  // ── Drivers: overspending categories sorted by overByExpected desc ────────────
  const drivers = perCategory
    .filter((c) => c.willOverspend)
    .sort((a, b) => b.overByExpected - a.overByExpected);

  // ── Data sufficiency ──────────────────────────────────────────────────────────
  const dataSufficiency: "ok" | "thin" =
    trends.months.length < MIN_MONTHS ? "thin" : "ok";

  return {
    perCategory,
    predictedVariableTotal,
    fixedBudget,
    expectedIncome,
    projectedSavingsRate,
    savingsRateTarget,
    vsTarget,
    vsLastMonth,
    drivers,
    dataSufficiency,
  };
}
