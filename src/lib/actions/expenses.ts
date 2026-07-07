"use server";

import { db } from "@/lib/db";
import { getFinancialPeriodBounds } from "@/lib/financial-period-utils";

export type CategoryTransaction = {
  id: string;
  date: Date;
  amount: number;
  note: string | null;
  wallet: string;
  mlCategoryName: string;
};

export async function getCategoryTransactions(
  appCategoryId: string,
  month: number,
  year: number
): Promise<CategoryTransaction[]> {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
  const { start, end } = getFinancialPeriodBounds(month, year, startDay);

  // Category resolution rule: direct appCategoryId (MANUAL) or via the
  // moneyLoverCategory mapping (MONEYLOVER) — union both in one query.
  const transactions = await db.transaction.findMany({
    where: {
      date: { gte: start, lt: end },
      OR: [
        { appCategoryId },
        { moneyLoverCategory: { mapping: { appCategoryId } } },
      ],
    },
    include: {
      moneyLoverCategory: true,
    },
    orderBy: { date: "asc" },
  });

  return transactions.map((t) => ({
    id: t.id,
    date: t.date,
    amount: t.amount,
    note: t.note,
    wallet: t.wallet,
    mlCategoryName: t.moneyLoverCategory?.name ?? "Manual",
  }));
}
