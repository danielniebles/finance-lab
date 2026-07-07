"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { TransactionSource } from "@/generated/prisma";

const PATHS = ["/expenses", "/overview", "/trends"] as const;

function revalidateAll() {
  for (const path of PATHS) revalidatePath(path);
}

/**
 * Creates a bot/manually-captured expense record — the "bot primary" path.
 * Not part of any ImportBatch (batchId null) and not linked to a
 * MoneyLoverCategory; the category is direct via appCategoryId.
 */
export async function createTransaction(data: {
  amount: number;
  date: Date;
  appCategoryId: string;
  wallet: string;
  note?: string;
}) {
  const created = await db.transaction.create({
    data: {
      amount: data.amount,
      date: data.date,
      appCategoryId: data.appCategoryId,
      wallet: data.wallet,
      note: data.note,
      source: TransactionSource.MANUAL,
      batchId: null,
      externalId: null,
      moneyLoverCategoryId: null,
    },
  });
  revalidateAll();
  return created;
}

/** Deletes a transaction (used for undo of a MANUAL add). */
export async function deleteTransaction(id: string) {
  await db.transaction.delete({ where: { id } });
  revalidateAll();
}
