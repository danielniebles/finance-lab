-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MONEYLOVER', 'MANUAL');

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_moneyLoverCategoryId_fkey";

-- AlterTable
ALTER TABLE "PendingProposal" ADD COLUMN     "editable" JSONB;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "appCategoryId" TEXT,
ADD COLUMN     "source" "TransactionSource" NOT NULL DEFAULT 'MONEYLOVER',
ALTER COLUMN "externalId" DROP NOT NULL,
ALTER COLUMN "batchId" DROP NOT NULL,
ALTER COLUMN "moneyLoverCategoryId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_moneyLoverCategoryId_fkey" FOREIGN KEY ("moneyLoverCategoryId") REFERENCES "MoneyLoverCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_appCategoryId_fkey" FOREIGN KEY ("appCategoryId") REFERENCES "AppCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
