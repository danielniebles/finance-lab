"use server";

import { db } from "@/lib/db";
import type { PrismaClient } from "@prisma/client";
import { parseMoneyLoverBuffer } from "@/lib/parse-moneylover";
import { revalidatePath } from "next/cache";

export async function importBuffer(buffer: Buffer, filename: string) {
  const startDay = parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);

  let parsed;
  try {
    parsed = parseMoneyLoverBuffer(buffer, startDay);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to parse file." };
  }

  const { transactions, categories, periodStart, periodEnd, month, year } = parsed;

  await db.$transaction(async (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => {
    // Delete existing batch for same month/year (replace strategy)
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
      data: { filename, periodStart, periodEnd, month, year },
    });

    // Insert transactions
    await tx.transaction.createMany({
      data: transactions.map((t) => ({
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
  return { success: true, month, year, count: transactions.length };
}

export async function importMoneyLoverFile(formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "No file provided." };
  return importBuffer(Buffer.from(await file.arrayBuffer()), file.name);
}
