// One-off data migration: import a MoneyLover "Investments (Wallet), All
// Categories" export directly against the investments Wallet.
//
// Bypasses importBuffer()'s per-month ImportBatch replace logic on purpose —
// that flow computes a single "dominant month" for the whole file and
// deletes/replaces the ImportBatch for that month, which is wrong for a
// multi-year, single-wallet historical export. Instead these transactions
// are inserted with batchId: null (same treatment as MANUAL entries).
//
// Usage:
//   node scripts/migrate-investments-wallet.mjs <path-to-xlsx> [--dry-run]
//
// Idempotent: re-running skips any row whose (date, amount) already exists
// on the target wallet, so it's safe to run again against the same file.
import { config as loadEnv } from "dotenv";
loadEnv();
loadEnv({ path: ".env.local", override: true });

import XLSX from "xlsx";
import { PrismaClient } from "../src/generated/prisma/client.js";

const TARGET_WALLET_NAME = "investments";

// MoneyLover category -> AppCategory name, for categories this file's export
// carries that aren't already mapped via the Settings > Mappings UI.
const FALLBACK_CATEGORY_MAP = {
  "Other Income": "Income",
  "Incoming transfer": "Income",
  "Outgoing transfer": "Withdrawal",
};

function parseRow(row) {
  const category = String(row["Category"] ?? "").trim();
  if (!category) return null;
  const rawDate = row["Date"];
  const date = rawDate instanceof Date ? rawDate : new Date(String(rawDate));
  if (isNaN(date.getTime())) return null;
  const amount = Number(row["Amount"]);
  if (isNaN(amount)) return null;
  return {
    externalId: Number(row["Id"]),
    date,
    category,
    amount,
    wallet: String(row["Wallet"] ?? "").trim(),
    note: row["Note"] ? String(row["Note"]).trim() : null,
  };
}

async function main() {
  const file = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!file) {
    console.error("Usage: node scripts/migrate-investments-wallet.mjs <path-to-xlsx> [--dry-run]");
    process.exit(1);
  }

  const db = new PrismaClient();

  const workbook = XLSX.readFile(file, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { raw: true });

  const transactions = rows.map(parseRow).filter((t) => t !== null);
  console.log(`Parsed ${transactions.length} rows from ${rows.length} raw rows`);

  const wallet = await db.wallet.findFirst({
    where: { name: { equals: TARGET_WALLET_NAME, mode: "insensitive" } },
  });
  if (!wallet) throw new Error(`Wallet "${TARGET_WALLET_NAME}" not found`);
  console.log("Target wallet:", wallet.id, wallet.name);

  const existing = await db.transaction.findMany({
    where: { walletId: wallet.id },
    select: { date: true, amount: true },
  });
  const existingKeys = new Set(existing.map((t) => `${t.date.toISOString()}:${t.amount}`));
  const toImport = transactions.filter((t) => !existingKeys.has(`${t.date.toISOString()}:${t.amount}`));
  console.log(`To import: ${toImport.length}, skipped as already-present: ${transactions.length - toImport.length}`);

  // All categories in the file, not just the ones on rows still to be
  // inserted — mappings should stay up to date even on a rerun where every
  // row already exists.
  const categoryNames = [...new Set(transactions.map((t) => t.category))];
  console.log("Categories in file:", categoryNames);

  if (dryRun) {
    console.log("--dry-run: not writing anything.");
    await db.$disconnect();
    return;
  }

  await db.$transaction(async (tx) => {
    for (const name of categoryNames) {
      await tx.moneyLoverCategory.upsert({ where: { name }, update: {}, create: { name } });
    }
    const mlCategories = await tx.moneyLoverCategory.findMany({ where: { name: { in: categoryNames } } });
    const categoryIdMap = Object.fromEntries(mlCategories.map((c) => [c.name, c.id]));

    // Fill in any mapping this MoneyLoverCategory is still missing, using the
    // fallback table above. Leaves already-mapped categories untouched.
    const appCategories = await tx.appCategory.findMany({
      where: { name: { in: [...new Set(Object.values(FALLBACK_CATEGORY_MAP))] } },
    });
    const appCategoryIdByName = Object.fromEntries(appCategories.map((c) => [c.name, c.id]));

    for (const mlCategory of mlCategories) {
      const fallbackAppName = FALLBACK_CATEGORY_MAP[mlCategory.name];
      if (!fallbackAppName) continue;
      const appCategoryId = appCategoryIdByName[fallbackAppName];
      if (!appCategoryId) continue;
      await tx.categoryMapping.upsert({
        where: { moneyLoverCategoryId: mlCategory.id },
        update: {},
        create: { moneyLoverCategoryId: mlCategory.id, appCategoryId },
      });
    }

    await tx.transaction.createMany({
      data: toImport.map((t) => ({
        externalId: t.externalId,
        date: t.date,
        amount: t.amount,
        wallet: t.wallet,
        walletId: wallet.id,
        note: t.note,
        batchId: null,
        moneyLoverCategoryId: categoryIdMap[t.category],
      })),
    });
  });

  const count = await db.transaction.count({ where: { walletId: wallet.id } });
  const sum = await db.transaction.aggregate({ where: { walletId: wallet.id }, _sum: { amount: true } });
  console.log(`Investments wallet now has ${count} transactions, net amount ${sum._sum.amount}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
