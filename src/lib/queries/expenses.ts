import { db } from "@/lib/db";

export async function getImportBatches() {
  return db.importBatch.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { _count: { select: { transactions: true } } },
  });
}

export type CategoryStatus =
  | "Fixed OK"
  | "Fixed changed"
  | "Under budget"
  | "Over budget"
  | "Unplanned";

export type CategorySeverity = "OK" | "Issue" | "Critical" | "Unplanned";

function getStatus(
  budgetType: string,
  spent: number,
  budget: number
): CategoryStatus {
  if (budgetType === "FIXED") {
    return spent === budget ? "Fixed OK" : "Fixed changed";
  }
  if (budget === 0) return spent > 0 ? "Unplanned" : "Under budget";
  return spent > budget ? "Over budget" : "Under budget";
}

function getSeverity(status: CategoryStatus): CategorySeverity {
  switch (status) {
    case "Fixed OK":
    case "Under budget":
      return "OK";
    case "Fixed changed":
      return "Issue";
    case "Over budget":
      return "Critical";
    case "Unplanned":
      return "Unplanned";
  }
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
    db.appCategory.findMany(),
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
    if (t.amount >= 0) continue; // skip income
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
    const budget = cat.monthlyBudget;
    const control = budget - spent; // positive = under budget
    const percentUsed = budget > 0 ? (spent / budget) * 100 : null;
    const status = getStatus(cat.budgetType, spent, budget);
    const severity = getSeverity(status);

    return {
      id: cat.id,
      name: cat.name,
      budgetType: cat.budgetType,
      spent,
      budget,
      control,
      percentUsed,
      status,
      severity,
    };
  });

  // Fixed / Variable subtotals
  const fixed = categoryBreakdown.filter((c) => c.budgetType === "FIXED");
  const variable = categoryBreakdown.filter((c) => c.budgetType === "VARIABLE");

  const fixedActual = fixed.reduce((s, c) => s + c.spent, 0);
  const fixedBudget = fixed.reduce((s, c) => s + c.budget, 0);

  const variableActual = variable.reduce((s, c) => s + c.spent, 0);
  const variableBudget = variable.reduce((s, c) => s + c.budget, 0);

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
      deficitCount: deficit.length,
      deficitTotal,
      offsetCoverage, // > 100% means surpluses cover deficits
    };
  }

  const fixedVariance = getVariance(fixed);
  const variableVariance = getVariance(variable);

  const totalBudget = fixedBudget + variableBudget;

  // Unplanned = variable categories with $0 budget but actual spend > 0
  const unplannedSpendTotal = variable
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
