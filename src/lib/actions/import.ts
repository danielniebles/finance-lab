"use server";

import { db } from "@/lib/db";
import { parseMoneyLoverBuffer, type RawTransaction } from "@/lib/parse-moneylover";
import { revalidatePath } from "next/cache";
import { BatchStatus } from "@/generated/prisma";

/** Calendar-day key (ignores time-of-day) for the conservative dedup match. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** amount+day key used to match a parsed row against an existing MANUAL transaction. */
function dedupKey(date: Date, amount: number): string {
  return `${dayKey(date)}:${amount}`;
}

/**
 * Splits parsed rows into those that import and those skipped because a
 * MANUAL transaction already captured them (bot-primary / backfill dedup).
 * Conservative match: same calendar day + exact amount only — no wallet/merchant
 * fuzziness, to avoid wrongly dropping a real second transaction that happens
 * to share day+amount with a bot-captured one.
 */
function partitionDuplicates(
  transactions: RawTransaction[],
  manualKeys: Set<string>,
): { toImport: RawTransaction[]; skipped: RawTransaction[] } {
  const toImport: RawTransaction[] = [];
  const skipped: RawTransaction[] = [];
  for (const t of transactions) {
    if (manualKeys.has(dedupKey(t.date, t.amount))) {
      skipped.push(t);
    } else {
      toImport.push(t);
    }
  }
  return { toImport, skipped };
}

export async function importBuffer(buffer: Buffer, filename: string, status?: BatchStatus) {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);

  let parsed;
  try {
    parsed = parseMoneyLoverBuffer(buffer, startDay);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to parse file." };
  }

  const { transactions, categories, periodStart, periodEnd, month, year } = parsed;

  // Heuristic: if the parsed month equals the current calendar month, mark IN_PROGRESS
  const now = new Date();
  const resolvedStatus: BatchStatus =
    status ??
    (month === now.getMonth() + 1 && year === now.getFullYear()
      ? BatchStatus.IN_PROGRESS
      : BatchStatus.FINAL);

  // Fetch existing MANUAL transactions in this file's date range ONCE (not per row),
  // then dedup parsed rows against them in memory.
  const manualTransactions = await db.transaction.findMany({
    where: {
      source: "MANUAL",
      date: { gte: periodStart, lte: periodEnd },
    },
    select: { date: true, amount: true },
  });
  const manualKeys = new Set(manualTransactions.map((t) => dedupKey(t.date, t.amount)));
  const { toImport, skipped } = partitionDuplicates(transactions, manualKeys);

  await db.$transaction(async (tx) => {
    // Delete existing batch for same month/year (replace strategy). Only ever
    // touches MONEYLOVER rows via cascade delete — MANUAL rows have batchId: null.
    await tx.importBatch.deleteMany({ where: { month, year } });

    // Upsert all MoneyLover categories found in this file
    for (const name of categories) {
      await tx.moneyLoverCategory.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }

    // Fetch category IDs
    const mlCategories = await tx.moneyLoverCategory.findMany({
      where: { name: { in: categories } },
      select: { id: true, name: true },
    });
    const categoryIdMap = Object.fromEntries(mlCategories.map((c: { id: string; name: string }) => [c.name, c.id]));

    // Create the import batch
    const batch = await tx.importBatch.create({
      data: { filename, periodStart, periodEnd, month, year, status: resolvedStatus },
    });

    // Insert only the non-duplicate transactions
    await tx.transaction.createMany({
      data: toImport.map((t) => ({
        externalId: t.externalId,
        date: t.date,
        amount: t.amount,
        wallet: t.wallet,
        note: t.note,
        batchId: batch.id,
        moneyLoverCategoryId: categoryIdMap[t.category],
      })),
    });
  });

  revalidatePath("/expenses");
  return {
    success: true,
    month,
    year,
    count: toImport.length,
    imported: toImport.length,
    skippedAsDuplicate: skipped.length,
    status: resolvedStatus,
  };
}

export async function importMoneyLoverFile(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided." };
  return importBuffer(Buffer.from(await file.arrayBuffer()), file.name);
}
