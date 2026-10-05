// HISTORICAL projection from past months (ADR-019), plus pacing mode for the
// month in progress. Phase B (getIncomePlan) is not yet shipped; expectedIncome
// falls back to trailing income average from getTrends.
// Pacing mode: when the target month is the current financial period, blends
// actuals-so-far (every transaction logged in the period, manual or imported)
// with the historical prediction (ADR-024, re-sourced by ADR-047).

import { getTrends } from "@/lib/queries/trends";
import { getMonthlyAnalysis } from "@/lib/queries/expenses";
import {
  MIN_MONTHS,
  blendPacedVariable,
  periodProgress,
  predictCategoryLanding,
  projectSavingsRate,
} from "@/lib/forecast-utils";
import { getFinancialPeriodBounds } from "@/lib/financial-period-utils";
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
  // Pacing mode fields — only present when the target month is the period in
  // progress. When present, projectedSavingsRate already uses projectedVariableSpend.
  pacingMode?: boolean;
  spentSoFar?: number; // variable spend logged so far this period
  projectedVariableSpend?: number;
  daysElapsed?: number;
  daysInMonth?: number;
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

  // ── Pacing mode: blend actuals-so-far with historical prediction ─────────────
  // Previously gated on an IN_PROGRESS ImportBatch, which never exists now that
  // transactions are logged directly (MoneyLover import is deprecated), and its
  // output was never fed into the projected rate. Now: if today is inside this
  // financial period, variable spend so far (getMonthlyAnalysis — date-range
  // based, transfers excluded, manual + Advisor/Telegram + imported rows) is
  // blended with the historical prediction and drives the projected rate.
  // Fixed costs stay on budget: they're front-loaded (rent on day 1), so
  // extrapolating them linearly would wildly overstate the month. ADR-047.
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const { start, end } = getFinancialPeriodBounds(month, year, startDay);
  const progress = periodProgress(new Date(), start, end);

  const pacing = progress
    ? {
        ...progress,
        spentSoFar: analysis.variableActual,
        ...blendPacedVariable({
          spentSoFar: analysis.variableActual,
          daysElapsed: progress.daysElapsed,
          daysInPeriod: progress.daysInPeriod,
          predicted: predictedVariableTotal,
        }),
      }
    : null;

  // ── Projected savings rate ────────────────────────────────────────────────────
  const projectedSavingsRate = projectSavingsRate({
    expectedIncome,
    fixedBudget,
    predictedVariable: pacing ? pacing.blended : predictedVariableTotal,
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

  const base = {
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

  if (!pacing) return base;

  return {
    ...base,
    pacingMode: true,
    spentSoFar: pacing.spentSoFar,
    projectedVariableSpend: pacing.blended,
    daysElapsed: pacing.daysElapsed,
    daysInMonth: pacing.daysInPeriod,
  };
}
