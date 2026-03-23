import { db } from "@/lib/db";

export async function getImportBatches() {
  return db.importBatch.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { _count: { select: { transactions: true } } },
  });
}

export async function getMonthlyAnalysis(month: number, year: number) {
  // All transactions for the month with their resolved app category
  const transactions = await db.transaction.findMany({
    where: {
      batch: { month, year },
    },
    include: {
      moneyLoverCategory: {
        include: { mapping: { include: { appCategory: true } } },
      },
    },
  });

  // All app categories with their budgets
  const appCategories = await db.appCategory.findMany();

  // Aggregate spend per app category
  const spendByCategory: Record<string, number> = {};
  const uncategorized: typeof transactions = [];

  for (const t of transactions) {
    const appCategory = t.moneyLoverCategory.mapping?.appCategory;
    if (!appCategory) {
      uncategorized.push(t);
      continue;
    }
    // Only count expenses (negative amounts)
    if (t.amount < 0) {
      spendByCategory[appCategory.id] =
        (spendByCategory[appCategory.id] ?? 0) + Math.abs(t.amount);
    }
  }

  // Total income and total expenses for savings calculation
  const totalIncome = transactions
    .filter((t: { amount: number }) => t.amount > 0)
    .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t: { amount: number }) => t.amount < 0)
    .reduce((sum: number, t: { amount: number }) => sum + Math.abs(t.amount), 0);

  const categoryBreakdown = appCategories.map((cat: { id: string; name: string; budgetType: string; monthlyBudget: number }) => ({
    id: cat.id,
    name: cat.name,
    budgetType: cat.budgetType,
    budget: cat.monthlyBudget,
    spent: spendByCategory[cat.id] ?? 0,
    remaining: cat.monthlyBudget - (spendByCategory[cat.id] ?? 0),
    overBudget: (spendByCategory[cat.id] ?? 0) > cat.monthlyBudget,
  }));

  const totalBudget = appCategories.reduce((s: number, c: { monthlyBudget: number }) => s + c.monthlyBudget, 0);
  const expectedSavings = totalIncome - totalBudget;
  const actualSavings = totalIncome - totalExpenses;

  return {
    categoryBreakdown,
    uncategorizedCount: uncategorized.length,
    totalIncome,
    totalExpenses,
    totalBudget,
    expectedSavings,
    actualSavings,
  };
}

export async function getUnmappedCategories() {
  return db.moneyLoverCategory.findMany({
    where: { mapping: null },
    orderBy: { name: "asc" },
  });
}
