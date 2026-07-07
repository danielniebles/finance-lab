import { db } from "@/lib/db";
import { getFinancialPeriodBounds } from "@/lib/financial-period-utils";
import { financialMonthYear } from "@/lib/parse-moneylover";

export async function getImportBatches() {
  return db.importBatch.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: {
      id: true,
      filename: true,
      importedAt: true,
      periodStart: true,
      periodEnd: true,
      month: true,
      year: true,
      status: true,
      _count: { select: { transactions: true } },
    },
  });
}

export type AvailableMonth = { month: number; year: number; status?: string };

/**
 * Union of financial months that have ANY data — from ImportBatch rows
 * (MoneyLover imports) and from standalone MANUAL transactions (bot-captured,
 * no batch). A month captured entirely by the bot has no ImportBatch row, so
 * without this union it would be invisible to the period selector / agent.
 *
 * `status` is the ImportBatch status when one exists for that month, else null
 * (a manual-only month has no partial-import concept, so it has no status).
 * Sorted ascending — mirrors the shape `page.tsx` queried inline before.
 */
export async function getAvailableMonths(): Promise<AvailableMonth[]> {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);

  const [batches, manualTransactions] = await Promise.all([
    db.importBatch.findMany({ select: { month: true, year: true, status: true } }),
    db.transaction.findMany({
      where: { source: "MANUAL" },
      select: { date: true },
    }),
  ]);

  const byKey = new Map<string, AvailableMonth>();
  for (const b of batches) {
    byKey.set(`${b.year}-${b.month}`, { month: b.month, year: b.year, status: b.status });
  }
  for (const t of manualTransactions) {
    const { month, year } = financialMonthYear(t.date, startDay);
    const key = `${year}-${month}`;
    if (!byKey.has(key)) {
      byKey.set(key, { month, year });
    }
  }

  return [...byKey.values()].sort((a, b) => a.year - b.year || a.month - b.month);
}

export type CategoryBudgetType = "FIXED" | "VARIABLE" | "MIXED";

export type CategorySeverity = "OK" | "Issue" | "Critical" | "Unplanned";

type CategoryClassification = {
  severity: CategorySeverity;
  note: string | null;
};

type BudgetItemShape = { amount: number; budgetType: "FIXED" | "VARIABLE" };

/**
 * AppCategory has no stored budgetType column — it's always derived from its
 * budgetItems. Shared by getMonthlyAnalysis's per-category breakdown and
 * getCategories() so the derivation lives in exactly one place.
 */
function deriveCategoryBudgetType(items: BudgetItemShape[]): {
  budgetType: CategoryBudgetType;
  fixedBudgetPortion: number;
  variableBudgetPortion: number;
} {
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

  return { budgetType, fixedBudgetPortion, variableBudgetPortion };
}

export type CategoryOption = { id: string; name: string; budgetType: CategoryBudgetType };

/** All AppCategories with their derived budgetType — used by the agent to guess/shortlist a category. */
export async function getCategories(): Promise<CategoryOption[]> {
  const categories = await db.appCategory.findMany({
    include: { budgetItems: true },
    orderBy: { name: "asc" },
  });
  return categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    budgetType: deriveCategoryBudgetType(cat.budgetItems).budgetType,
  }));
}

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

type AnalysisTransaction = {
  amount: number;
  appCategory: { id: string } | null;
  moneyLoverCategory: { mapping: { appCategory: { id: string } | null } | null } | null;
};

/**
 * Aggregates expense spend per resolved AppCategory id. Category resolution
 * rule: direct appCategory (MANUAL) or the moneyLoverCategory's mapping
 * (MONEYLOVER) — moneyLoverCategory is nullable too, since MANUAL rows have neither.
 */
function buildSpendByCategory(
  transactions: AnalysisTransaction[],
): { spendByCategory: Record<string, number>; uncategorizedCount: number } {
  const spendByCategory: Record<string, number> = {};
  let uncategorizedCount = 0;

  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const appCategory = t.appCategory ?? t.moneyLoverCategory?.mapping?.appCategory;
    if (!appCategory) {
      uncategorizedCount++;
      continue;
    }
    spendByCategory[appCategory.id] = (spendByCategory[appCategory.id] ?? 0) + Math.abs(t.amount);
  }

  return { spendByCategory, uncategorizedCount };
}

type AnalysisAppCategory = { id: string; name: string; budgetItems: BudgetItemShape[] };

function buildCategoryBreakdown(
  appCategories: AnalysisAppCategory[],
  spendByCategory: Record<string, number>,
) {
  return appCategories.map((cat) => {
    const spent = spendByCategory[cat.id] ?? 0;
    const items = cat.budgetItems;

    // Derive budget and type from line items
    const budget = items.reduce((s, i) => s + i.amount, 0);
    const { budgetType, fixedBudgetPortion, variableBudgetPortion } =
      deriveCategoryBudgetType(items);

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
}

type BreakdownRow = ReturnType<typeof buildCategoryBreakdown>[number];

// Surplus / deficit breakdown for a group of categories (fixed or variable/mixed)
function getVariance(cats: BreakdownRow[]) {
  const surplus = cats.filter((c) => c.control > 0);
  const deficit = cats.filter((c) => c.control < 0);
  const surplusTotal = surplus.reduce((s, c) => s + c.control, 0);
  const deficitTotal = deficit.reduce((s, c) => s + Math.abs(c.control), 0);
  const offsetCoverage = deficitTotal > 0 ? (surplusTotal / deficitTotal) * 100 : null;
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

// Worst severity first, then by overspend amount
function computeTopOffenders(categoryBreakdown: BreakdownRow[]) {
  const severityOrder: Record<CategorySeverity, number> = {
    Critical: 0,
    Unplanned: 1,
    Issue: 2,
    OK: 99,
  };
  return [...categoryBreakdown]
    .filter((c) => c.severity !== "OK")
    .sort((a, b) => {
      const diff = severityOrder[a.severity] - severityOrder[b.severity];
      if (diff !== 0) return diff;
      return Math.abs(b.control) - Math.abs(a.control);
    })
    .slice(0, 3);
}

export async function getMonthlyAnalysis(month: number, year: number) {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const { start, end } = getFinancialPeriodBounds(month, year, startDay);

  const [transactions, appCategories, batch] = await Promise.all([
    db.transaction.findMany({
      where: { date: { gte: start, lt: end } },
      include: {
        appCategory: true,
        moneyLoverCategory: {
          include: { mapping: { include: { appCategory: true } } },
        },
      },
    }),
    db.appCategory.findMany({ include: { budgetItems: true } }),
    db.importBatch.findFirst({ where: { month, year }, select: { status: true } }),
  ]);

  const isInProgress = batch?.status === "IN_PROGRESS";

  const totalIncome = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const { spendByCategory, uncategorizedCount } = buildSpendByCategory(transactions);
  const categoryBreakdown = buildCategoryBreakdown(appCategories, spendByCategory);

  // Fixed / Variable subtotals (budget from item-level aggregation, actual from category grouping)
  const fixedOnlyCats = categoryBreakdown.filter((c) => c.budgetType === "FIXED");
  const variableOrMixedCats = categoryBreakdown.filter((c) => c.budgetType !== "FIXED");

  const fixedBudget = categoryBreakdown.reduce((s, c) => s + c.fixedBudgetPortion, 0);
  const variableBudget = categoryBreakdown.reduce((s, c) => s + c.variableBudgetPortion, 0);

  const fixedActual = fixedOnlyCats.reduce((s, c) => s + c.spent, 0);
  const variableActual = variableOrMixedCats.reduce((s, c) => s + c.spent, 0);

  const variableBurnRate = variableBudget > 0 ? (variableActual / variableBudget) * 100 : null;

  const fixedVariance = getVariance(fixedOnlyCats);
  const variableVariance = getVariance(variableOrMixedCats);

  const totalBudget = fixedBudget + variableBudget;

  // Unplanned = variable/mixed categories with $0 budget but actual spend > 0
  const unplannedSpendTotal = variableOrMixedCats
    .filter((c) => c.budget === 0 && c.spent > 0)
    .reduce((s, c) => s + c.spent, 0);

  const idealSavings = totalIncome - totalBudget;
  const realSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (realSavings / totalIncome) * 100 : null;
  const savingsGap = realSavings - idealSavings;

  const topOffenders = computeTopOffenders(categoryBreakdown);

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
    isInProgress,
  };
}

export async function getUnmappedCategories() {
  return db.moneyLoverCategory.findMany({
    where: { mapping: null },
    orderBy: { name: "asc" },
  });
}
