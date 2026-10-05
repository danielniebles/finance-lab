import { db } from "@/lib/db";
import { getFinancialPeriodBounds } from "@/lib/financial-period-utils";
import { trendWindow, trimLeadingEmpty, type TrendSlot } from "@/lib/trend-utils";

export type MonthPoint = {
  month: number;
  year: number;
  label: string; // "Mar 2026"
  income: number;
  expenses: number;
  budget: number;
  net: number; // income - expenses (positive = surplus, negative = deficit)
  savingsRate: number | null;
  /** The current financial month — still running, so partial. */
  inProgress: boolean;
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

type Period = TrendSlot & { start: Date; end: Date };

type TrendCategory = { id: string; name: string; budgetItems: { amount: number }[] };

type TrendTransaction = {
  date: Date;
  amount: number;
  appCategory: { id: string } | null;
  moneyLoverCategory: { mapping: { appCategory: { id: string } | null } | null } | null;
};

/** Assigns a transaction's date to its period key ("month-year"), or null if outside all periods. */
function periodKeyForDate(periods: Period[], date: Date): string | null {
  const match = periods.find((p) => date >= p.start && date < p.end);
  return match ? `${match.month}-${match.year}` : null;
}

function buildMonthPoints(
  periods: Period[],
  transactions: TrendTransaction[],
  totalBudget: number,
): MonthPoint[] {
  return periods.map((p) => {
    const key = `${p.month}-${p.year}`;
    const monthTxns = transactions.filter((t) => periodKeyForDate(periods, t.date) === key);

    const income = monthTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expenses = monthTxns
      .filter((t) => t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);

    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : null;

    return {
      month: p.month,
      year: p.year,
      label: `${MONTH_NAMES[p.month - 1]} ${p.year}`,
      income,
      expenses,
      budget: totalBudget,
      net: income - expenses,
      savingsRate,
      inProgress: p.inProgress,
    };
  });
}

/** Spend per period per category, keyed by "month-year" then categoryId. Expenses only. */
function buildSpendByPeriodAndCategory(
  periods: Period[],
  transactions: TrendTransaction[],
): Record<string, Record<string, number>> {
  const spend: Record<string, Record<string, number>> = {};
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const appCategory = t.appCategory ?? t.moneyLoverCategory?.mapping?.appCategory;
    if (!appCategory) continue;
    const key = periodKeyForDate(periods, t.date);
    if (!key) continue;
    spend[key] ??= {};
    spend[key][appCategory.id] = (spend[key][appCategory.id] ?? 0) + Math.abs(t.amount);
  }
  return spend;
}

function buildCategoryTrends(
  periods: Period[],
  appCategories: TrendCategory[],
  spendByPeriodAndCategory: Record<string, Record<string, number>>,
): CategoryTrendRow[] {
  const activeCategoryIds = new Set<string>();
  for (const periodSpend of Object.values(spendByPeriodAndCategory)) {
    for (const id of Object.keys(periodSpend)) activeCategoryIds.add(id);
  }

  return appCategories
    .filter((c) => activeCategoryIds.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      budget: c.budgetItems.reduce((s, i) => s + i.amount, 0),
      months: periods.map((p) => spendByPeriodAndCategory[`${p.month}-${p.year}`]?.[c.id] ?? null),
    }))
    .sort((a, b) => {
      const sumA = a.months.reduce((s, v) => s + (v ?? 0), 0);
      const sumB = b.months.reduce((s, v) => s + (v ?? 0), 0);
      return sumB - sumA;
    });
}

/**
 * Monthly income/spend history for the last `n` complete financial months,
 * oldest → newest. `includeCurrent` appends the month in progress (flagged
 * `inProgress`) — the Trends page draws it as a draft; baselines (forecast,
 * Advisor) leave it out so a half-month never drags averages down.
 */
export async function getTrends(n = 6, { includeCurrent = false }: { includeCurrent?: boolean } = {}): Promise<TrendsData> {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const window: Period[] = trendWindow(new Date(), n, startDay, includeCurrent).map((m) => ({
    ...m,
    ...getFinancialPeriodBounds(m.month, m.year, startDay),
  }));

  const [allTransactions, appCategories] = await Promise.all([
    db.transaction.findMany({
      // isTransfer excluded — see AppCategory.isTransfer's doc comment.
      where: { isTransfer: false, date: { gte: window[0].start, lt: window[window.length - 1].end } },
      include: {
        appCategory: true,
        moneyLoverCategory: {
          include: { mapping: { include: { appCategory: true } } },
        },
      },
    }),
    db.appCategory.findMany({ where: { isTransfer: false }, include: { budgetItems: true } }),
  ]);

  const periods = trimLeadingEmpty(window, (p) => allTransactions.some((t) => t.date >= p.start && t.date < p.end));
  if (periods.length === 0) return { months: [], categoryTrends: [] };

  const totalBudget = appCategories.reduce(
    (s, c) => s + c.budgetItems.reduce((si, i) => si + i.amount, 0),
    0
  );

  const monthPoints = buildMonthPoints(periods, allTransactions, totalBudget);
  const spendByPeriodAndCategory = buildSpendByPeriodAndCategory(periods, allTransactions);
  const categoryTrends = buildCategoryTrends(periods, appCategories, spendByPeriodAndCategory);

  return { months: monthPoints, categoryTrends };
}
