-- CreateTable
CREATE TABLE "BudgetItem" (
    "id" TEXT NOT NULL,
    "appCategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "budgetType" "BudgetType" NOT NULL,

    CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_appCategoryId_fkey"
    FOREIGN KEY ("appCategoryId") REFERENCES "AppCategory"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: preserve existing category budgets as budget items
INSERT INTO "BudgetItem" ("id", "appCategoryId", "name", "amount", "budgetType")
SELECT
    'migrated_' || "id",
    "id",
    "name",
    "monthlyBudget",
    "budgetType"
FROM "AppCategory"
WHERE "monthlyBudget" > 0;

-- AlterTable: drop old columns
ALTER TABLE "AppCategory" DROP COLUMN "budgetType",
                           DROP COLUMN "monthlyBudget";
