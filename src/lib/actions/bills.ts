"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { TransactionSource } from "@/generated/prisma";
import { parseISODate } from "@/lib/form-format";

/**
 * Pay bills (ADR-052): one expense per bill, in the bill's category, with the
 * bill's name as the note and `budgetItemId` linking it, all from one wallet
 * on one date. All or nothing. Returns `{ error }` instead of throwing —
 * thrown messages are hidden from the client in production.
 */
export async function payBills(input: {
  walletId: string;
  /** "YYYY-MM-DD" */
  date: string;
  bills: { budgetItemId: string; amount: number }[];
}): Promise<{ error?: string; count?: number }> {
  if (input.bills.length === 0) return { error: "Tick at least one bill." };
  if (input.bills.some((b) => !Number.isFinite(b.amount) || b.amount <= 0)) return { error: "Every bill needs an amount." };
  const date = parseISODate(input.date);
  if (!date) return { error: "Pick a date." };

  const [wallet, items] = await Promise.all([
    db.wallet.findUnique({ where: { id: input.walletId }, select: { id: true, name: true } }),
    db.budgetItem.findMany({
      where: { id: { in: input.bills.map((b) => b.budgetItemId) }, isBill: true },
      select: { id: true, name: true, appCategoryId: true },
    }),
  ]);
  if (!wallet) return { error: "That wallet no longer exists." };
  const byId = new Map(items.map((i) => [i.id, i]));
  if (input.bills.some((b) => !byId.has(b.budgetItemId))) return { error: "One of these bills was changed or removed. Reopen Pay bills." };

  await db.transaction.createMany({
    data: input.bills.map((b) => {
      const item = byId.get(b.budgetItemId)!;
      return {
        amount: -b.amount,
        date,
        appCategoryId: item.appCategoryId,
        budgetItemId: item.id,
        wallet: wallet.name,
        walletId: wallet.id,
        note: item.name,
        source: TransactionSource.MANUAL,
      };
    }),
  });

  for (const path of ["/expenses", "/overview", "/trends"]) revalidatePath(path);
  return { count: input.bills.length };
}
