import { db } from "@/lib/db";
import { historySearchToken, pickHistoricalCategoryId } from "@/lib/category-history";

// Enough recent rows to see a habit without scanning the whole ledger.
const HISTORY_LIMIT = 200;

/**
 * The category the user has most often given past transactions with this
 * counterparty (merchant, sender or note text), or undefined when there is no
 * such history. Transfers are left out: they carry no spending category.
 */
export async function getHistoricalCategoryId(counterparty: string): Promise<string | undefined> {
  const token = historySearchToken(counterparty);
  if (!token) return undefined;

  const rows = await db.transaction.findMany({
    where: {
      note: { contains: token, mode: "insensitive" },
      appCategoryId: { not: null },
      isTransfer: false,
    },
    orderBy: { date: "desc" },
    take: HISTORY_LIMIT,
    select: { note: true, appCategoryId: true },
  });
  return pickHistoricalCategoryId(rows, counterparty);
}
