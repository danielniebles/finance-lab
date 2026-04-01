"use server";

import { db } from "@/lib/db";

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
  const transactions = await db.transaction.findMany({
    where: {
      batch: { month, year },
      moneyLoverCategory: {
        mapping: { appCategoryId },
      },
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
    mlCategoryName: t.moneyLoverCategory.name,
  }));
}
