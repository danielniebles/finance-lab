-- ADR-052: bills are flagged budget items; a payment links to its item.

-- AlterTable
ALTER TABLE "BudgetItem" ADD COLUMN "isBill" BOOLEAN NOT NULL DEFAULT false;

-- Every fixed item starts as a bill; variable ones (electricity) are opted in by hand.
UPDATE "BudgetItem" SET "isBill" = true WHERE "budgetType" = 'FIXED';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "budgetItemId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_budgetItemId_idx" ON "Transaction"("budgetItemId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
