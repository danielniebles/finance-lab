import { db } from "@/lib/db";

export type MonthPoint = {
  month: number;
  year: number;
  label: string; // "Mar 2026"
  income: number;
  expenses: number;
  budget: number;
  net: number; // income - expenses (positive = surplus, negative = deficit)
  savingsRate: number | null;
};

export type CategoryTrendRow = {
  id: string;
  name: string;
  budget: number; // monthly budget for this category
  months: (number | null)[]; // spend per month slot, null = no data
};

export type TrendsData = {
  months: MonthPoint[];
  categoryTrends: CategoryTrendRow[];
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export async function getTrends(n = 6): Promise<TrendsData> {
  // Fetch the n most recent batches that have transactions
  const batches = await db.importBatch.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    take: n,
  });

  if (batches.length === 0) {
    return { months: [], categoryTrends: [] };
  }

  // Reverse so oldest → newest (left → right on charts)
  batches.reverse();

  const [allTransactions, appCategories] = await Promise.all([
    db.transaction.findMany({
      where: {
        batch: {
          OR: batches.map((b) => ({ month: b.month, year: b.year })),
        },
      },
      include: {
        moneyLoverCategory: {
          include: { mapping: { include: { appCategory: true } } },
        },
        batch: { select: { month: true, year: true } },
      },
    }),
    db.appCategory.findMany({ include: { budgetItems: true } }),
  ]);

  // Per-batch aggregation
  const monthPoints: MonthPoint[] = batches.map((b) => {
    const batchTxns = allTransactions.filter(
      (t) => t.batch.month === b.month && t.batch.year === b.year
    );

    const income = batchTxns
      .filter((t) => t.amount > 0)
      .reduce((s, t) => s + t.amount, 0);

    const expenses = batchTxns
      .filter((t) => t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    const budget = appCategories.reduce(
      (s, c) => s + c.budgetItems.reduce((si, i) => si + i.amount, 0),
      0
    );

    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : null;
    const net = income - expenses;

    return {
      month: b.month,
      year: b.year,
      label: `${MONTH_NAMES[b.month - 1]} ${b.year}`,
      income,
      expenses,
      budget,
      net,
      savingsRate,
    };
  });

  // Category spend per month
  const spendByMonthAndCategory: Record<string, Record<string, number>> = {};
  // key: "month-year", value: { categoryId: amount }

  for (const t of allTransactions) {
    if (t.amount >= 0) continue;
    const appCategory = t.moneyLoverCategory.mapping?.appCategory;
    if (!appCategory) continue;
    const key = `${t.batch.month}-${t.batch.year}`;
    if (!spendByMonthAndCategory[key]) spendByMonthAndCategory[key] = {};
    spendByMonthAndCategory[key][appCategory.id] =
      (spendByMonthAndCategory[key][appCategory.id] ?? 0) + Math.abs(t.amount);
  }

  // Only include categories that have spend in at least one month
  const activeCategoryIds = new Set<string>();
  for (const monthData of Object.values(spendByMonthAndCategory)) {
    for (const id of Object.keys(monthData)) {
      activeCategoryIds.add(id);
    }
  }

  const categoryTrends: CategoryTrendRow[] = appCategories
    .filter((c) => activeCategoryIds.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      budget: c.budgetItems.reduce((s, i) => s + i.amount, 0),
      months: batches.map((b) => {
        const key = `${b.month}-${b.year}`;
        return spendByMonthAndCategory[key]?.[c.id] ?? null;
      }),
    }))
    // Sort by total spend descending
    .sort((a, b) => {
      const sumA = a.months.reduce((s, v) => s + (v ?? 0), 0);
      const sumB = b.months.reduce((s, v) => s + (v ?? 0), 0);
      return sumB - sumA;
    });

  return { months: monthPoints, categoryTrends };
}
