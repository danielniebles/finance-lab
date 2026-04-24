import { db } from "@/lib/db";

export async function getImportBatches() {
  return db.importBatch.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { _count: { select: { transactions: true } } },
  });
}

export type CategoryBudgetType = "FIXED" | "VARIABLE" | "MIXED";

export type CategorySeverity = "OK" | "Issue" | "Critical" | "Unplanned";

type CategoryClassification = {
  severity: CategorySeverity;
  note: string | null;
};

// ─── Single source of truth for category health classification ────────────────
//
// FIXED categories: severity is note-driven (amount deviation or unpaid flag)
//   spent = 0          → Issue  + "Unpaid"              (flag for review)
//   spent = budget     → OK     + no note               (as expected)
//   spent < budget     → OK     + "Lower than expected" (informational)
//   spent > budget     → Issue  + "Higher than expected"(informational)
//
// VARIABLE / MIXED: severity is proportional to percentUsed
//   budget = 0, spent > 0 → Unplanned
//   ≤ 100%                → OK
//   101 – 120%            → Issue    (mildly over)
//   > 120%                → Critical (significantly over)
// ─────────────────────────────────────────────────────────────────────────────
function classifyCategory(
  budgetType: CategoryBudgetType,
  spent: number,
  budget: number,
  percentUsed: number | null,
): CategoryClassification {
  if (budgetType === "FIXED") {
    if (spent === 0)      return { severity: "Issue", note: "Unpaid" };
    if (spent === budget) return { severity: "OK",    note: null };
    if (spent < budget)   return { severity: "OK",    note: "Lower than expected" };
    /* spent > budget */  return { severity: "Issue", note: "Higher than expected" };
  }
  // VARIABLE or MIXED
  if (budget === 0) return spent > 0
    ? { severity: "Unplanned", note: null }
    : { severity: "OK",        note: null };
  if (!percentUsed || percentUsed <= 100) return { severity: "OK",       note: null };
  if (percentUsed <= 120)                 return { severity: "Issue",    note: null };
  /* percentUsed > 120 */                 return { severity: "Critical", note: null };
}

export async function getMonthlyAnalysis(month: number, year: number) {
  const [transactions, appCategories] = await Promise.all([
    db.transaction.findMany({
      where: { batch: { month, year } },
      include: {
        moneyLoverCategory: {
          include: { mapping: { include: { appCategory: true } } },
        },
      },
    }),
    db.appCategory.findMany({ include: { budgetItems: true } }),
  ]);

  // Split income (positive) vs expenses (negative)
  const totalIncome = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Aggregate spend per app category (expenses only)
  const spendByCategory: Record<string, number> = {};
  let uncategorizedCount = 0;

  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const appCategory = t.moneyLoverCategory.mapping?.appCategory;
    if (!appCategory) {
      uncategorizedCount++;
      continue;
    }
    spendByCategory[appCategory.id] =
      (spendByCategory[appCategory.id] ?? 0) + Math.abs(t.amount);
  }

  // Build category breakdown
  const categoryBreakdown = appCategories.map((cat) => {
    const spent = spendByCategory[cat.id] ?? 0;
    const items = cat.budgetItems;

    // Derive budget and type from line items
    const budget = items.reduce((s, i) => s + i.amount, 0);
    const fixedBudgetPortion = items
      .filter((i) => i.budgetType === "FIXED")
      .reduce((s, i) => s + i.amount, 0);
    const variableBudgetPortion = items
      .filter((i) => i.budgetType === "VARIABLE")
      .reduce((s, i) => s + i.amount, 0);

    const hasFixed = fixedBudgetPortion > 0;
    const hasVariable = variableBudgetPortion > 0;
    const budgetType: CategoryBudgetType =
      hasFixed && hasVariable ? "MIXED" : hasFixed ? "FIXED" : "VARIABLE";

    const control = budget - spent;
    const percentUsed = budget > 0 ? (spent / budget) * 100 : null;
    const { severity, note } = classifyCategory(budgetType, spent, budget, percentUsed);

    return {
      id: cat.id,
      name: cat.name,
      budgetType,
      fixedBudgetPortion,
      variableBudgetPortion,
      spent,
      budget,
      control,
      percentUsed,
      note,
      severity,
    };
  });

  // Fixed / Variable subtotals (budget from item-level aggregation, actual from category grouping)
  const fixedOnlyCats = categoryBreakdown.filter((c) => c.budgetType === "FIXED");
  const variableOrMixedCats = categoryBreakdown.filter((c) => c.budgetType !== "FIXED");

  // Budget totals: sum all FIXED / VARIABLE item amounts across all categories
  const fixedBudget = categoryBreakdown.reduce(
    (s, c) => s + c.fixedBudgetPortion,
    0
  );
  const variableBudget = categoryBreakdown.reduce(
    (s, c) => s + c.variableBudgetPortion,
    0
  );

  // Actual totals: Fixed-only categories vs Variable+Mixed categories
  const fixedActual = fixedOnlyCats.reduce((s, c) => s + c.spent, 0);
  const variableActual = variableOrMixedCats.reduce((s, c) => s + c.spent, 0);

  const variableBurnRate =
    variableBudget > 0 ? (variableActual / variableBudget) * 100 : null;

  // Surplus / deficit breakdown per group
  function getVariance(cats: typeof categoryBreakdown) {
    const surplus = cats.filter((c) => c.control > 0);
    const deficit = cats.filter((c) => c.control < 0);
    const surplusTotal = surplus.reduce((s, c) => s + c.control, 0);
    const deficitTotal = deficit.reduce((s, c) => s + Math.abs(c.control), 0);
    const offsetCoverage =
      deficitTotal > 0 ? (surplusTotal / deficitTotal) * 100 : null;
    return {
      surplusCount: surplus.length,
      surplusTotal,
      surplusCategories: surplus
        .sort((a, b) => b.control - a.control)
        .map((c) => ({ name: c.name, control: c.control })),
      deficitCount: deficit.length,
      deficitTotal,
      deficitCategories: deficit
        .sort((a, b) => Math.abs(b.control) - Math.abs(a.control))
        .map((c) => ({ name: c.name, control: c.control })),
      offsetCoverage,
    };
  }

  const fixedVariance = getVariance(fixedOnlyCats);
  const variableVariance = getVariance(variableOrMixedCats);

  const totalBudget = fixedBudget + variableBudget;

  // Unplanned = variable/mixed categories with $0 budget but actual spend > 0
  const unplannedSpendTotal = variableOrMixedCats
    .filter((c) => c.budget === 0 && c.spent > 0)
    .reduce((s, c) => s + c.spent, 0);

  // Savings
  const idealSavings = totalIncome - totalBudget;
  const realSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (realSavings / totalIncome) * 100 : null;
  const savingsGap = realSavings - idealSavings;

  // Top offenders — worst severity first, then by overspend amount
  const severityOrder: Record<CategorySeverity, number> = {
    Critical: 0,
    Unplanned: 1,
    Issue: 2,
    OK: 99,
  };
  const topOffenders = [...categoryBreakdown]
    .filter((c) => c.severity !== "OK")
    .sort((a, b) => {
      const diff = severityOrder[a.severity] - severityOrder[b.severity];
      if (diff !== 0) return diff;
      return Math.abs(b.control) - Math.abs(a.control);
    })
    .slice(0, 3);

  return {
    categoryBreakdown,
    topOffenders,
    uncategorizedCount,
    totalIncome,
    totalExpenses,
    totalBudget,
    overexpense: totalExpenses - totalBudget,
    fixedActual,
    fixedBudget,
    fixedVariance,
    variableActual,
    variableBudget,
    variableVariance,
    variableBurnRate,
    unplannedSpendTotal,
    idealSavings,
    realSavings,
    savingsRate,
    savingsGap,
  };
}

export async function getUnmappedCategories() {
  return db.moneyLoverCategory.findMany({
    where: { mapping: null },
    orderBy: { name: "asc" },
  });
}
