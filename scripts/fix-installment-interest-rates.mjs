// One-off data cleanup: round every Installment.monthlyInterestRate to 4
// decimals. Before ADR-044, the EA->monthly conversion stored unrounded
// floats (e.g. 2.088436099590463 for "Cuota Javier"); the display side was
// fixed to render cleanly, but existing rows were left as-is (see
// docs/backlog.md). This closes that out.
//
// Idempotent: rows already rounded to 4 decimals are skipped.
//
// Usage:
//   node scripts/fix-installment-interest-rates.mjs [--dry-run] [--prod]
//
// By default .env.local overrides .env (local Docker DB, same as `next dev`).
// Pass --prod to skip that override and use the production DATABASE_URL
// from .env instead.
import { config as loadEnv } from "dotenv";
loadEnv();
if (!process.argv.includes("--prod")) {
  loadEnv({ path: ".env.local", override: true });
}

import { PrismaClient } from "../src/generated/prisma/client.js";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = new PrismaClient();

  const installments = await db.installment.findMany({
    where: { monthlyInterestRate: { not: null } },
    select: { id: true, description: true, monthlyInterestRate: true },
  });

  const toFix = installments
    .map((i) => ({ ...i, rounded: Math.round(i.monthlyInterestRate * 10000) / 10000 }))
    .filter((i) => i.rounded !== i.monthlyInterestRate);

  if (toFix.length === 0) {
    console.log("Nothing to fix — all monthlyInterestRate values are already rounded.");
    await db.$disconnect();
    return;
  }

  console.log(`${dryRun ? "[dry-run] " : ""}${toFix.length} row(s) to fix:`);
  for (const i of toFix) {
    console.log(`  ${i.id} (${i.description}): ${i.monthlyInterestRate} -> ${i.rounded}`);
  }

  if (dryRun) {
    await db.$disconnect();
    return;
  }

  for (const i of toFix) {
    await db.installment.update({ where: { id: i.id }, data: { monthlyInterestRate: i.rounded } });
  }
  console.log(`Updated ${toFix.length} row(s).`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
