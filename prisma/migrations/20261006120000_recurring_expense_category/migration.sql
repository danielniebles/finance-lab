-- Link recurring expenses to a real AppCategory (ADR-050).
-- The old free-text "category" column is kept untouched as a legacy label.

-- AlterTable
ALTER TABLE "RecurringExpense" ADD COLUMN "appCategoryId" TEXT;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_appCategoryId_fkey" FOREIGN KEY ("appCategoryId") REFERENCES "AppCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: link every expense whose text label matches a category name
-- (case- and space-insensitive). Unmatched labels stay as they are, unlinked.
UPDATE "RecurringExpense" AS r
SET "appCategoryId" = c."id"
FROM "AppCategory" AS c
WHERE r."category" IS NOT NULL
  AND c."isTransfer" = false
  AND lower(btrim(r."category")) = lower(btrim(c."name"));
