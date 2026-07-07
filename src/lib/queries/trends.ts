import { db } from "@/lib/db";
import { getFinancialPeriodBounds } from "@/lib/financial-period-utils";
import { financialMonthYear } from "@/lib/parse-moneylover";

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

type TrendMonth = { month: number; year: number };

/**
 * The N most recent financial months eligible for trend baselines.
 *
 * A month qualifies if it has a FINAL ImportBatch, OR has standalone MANUAL
 * transactions with no batch at all. IN_PROGRESS-only months are excluded
 * (partial MoneyLover imports corrupt baselines) — but that exclusion is
 * specific to the partial-import concept, which does not apply to bot-captured
 * data: a manual-only month has no "in progress" state, so it always counts.
 * (Design call — see .scratch/transactions-data-layer.md.)
 */
async function getRecentTrendMonths(n: number): Promise<TrendMonth[]> {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);

  const [batches, manualTransactions] = await Promise.all([
    db.importBatch.findMany({ select: { month: true, year: true, status: true } }),
    db.transaction.findMany({ where: { source: "MANUAL" }, select: { date: true } }),
  ]);

  const finalKeys = new Set(
    batches.filter((b) => b.status === "FINAL").map((b) => `${b.year}-${b.month}`)
  );
  const inProgressKeys = new Set(
    batches.filter((b) => b.status === "IN_PROGRESS").map((b) => `${b.year}-${b.month}`)
  );

  const eligible = new Map<string, TrendMonth>();
  for (const b of batches) {
    const key = `${b.year}-${b.month}`;
    if (b.status === "FINAL") eligible.set(key, { month: b.month, year: b.year });
  }
  for (const t of manualTransactions) {
    const { month, year } = financialMonthYear(t.date, startDay);
    const key = `${year}-${month}`;
    // A manual-only month (no batch at all) always counts. A month that also
    // has an IN_PROGRESS batch stays excluded even though it has manual data —
    // the month's AGGREGATE totals (manual + partial MoneyLover) are still
    // incomplete, so the whole month stays untrustworthy as a trend baseline.
    if (inProgressKeys.has(key) && !finalKeys.has(key)) continue;
    if (!eligible.has(key)) eligible.set(key, { month, year });
  }

  return [...eligible.values()]
    .sort((a, b) => b.year - a.year || b.month - a.month)
    .slice(0, n);
}

type Period = TrendMonth & { start: Date; end: Date };

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

export async function getTrends(n = 6): Promise<TrendsData> {
  const months = await getRecentTrendMonths(n);
  if (months.length === 0) {
    return { months: [], categoryTrends: [] };
  }

  // Reverse so oldest → newest (left → right on charts)
  months.reverse();

  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const periods: Period[] = months.map((m) => ({
    ...m,
    ...getFinancialPeriodBounds(m.month, m.year, startDay),
  }));

  const [allTransactions, appCategories] = await Promise.all([
    db.transaction.findMany({
      where: { OR: periods.map((p) => ({ date: { gte: p.start, lt: p.end } })) },
      include: {
        appCategory: true,
        moneyLoverCategory: {
          include: { mapping: { include: { appCategory: true } } },
        },
      },
    }),
    db.appCategory.findMany({ include: { budgetItems: true } }),
  ]);

  const totalBudget = appCategories.reduce(
    (s, c) => s + c.budgetItems.reduce((si, i) => si + i.amount, 0),
    0
  );

  const monthPoints = buildMonthPoints(periods, allTransactions, totalBudget);
  const spendByPeriodAndCategory = buildSpendByPeriodAndCategory(periods, allTransactions);
  const categoryTrends = buildCategoryTrends(periods, appCategories, spendByPeriodAndCategory);

  return { months: monthPoints, categoryTrends };
}
