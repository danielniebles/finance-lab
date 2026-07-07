-- CreateEnum
CREATE TYPE "RuleMatchType" AS ENUM ('ACCOUNT', 'MERCHANT', 'SENDER', 'KEYWORD');

-- CreateEnum
CREATE TYPE "RuleDirection" AS ENUM ('EXPENSE', 'INCOME', 'ANY');

-- CreateTable
CREATE TABLE "CounterpartyRule" (
    "id" TEXT NOT NULL,
    "matchType" "RuleMatchType" NOT NULL,
    "matchValue" TEXT NOT NULL,
    "direction" "RuleDirection" NOT NULL DEFAULT 'ANY',
    "appCategoryId" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "autoRecord" BOOLEAN NOT NULL DEFAULT true,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "expectedAmount" DOUBLE PRECISION,
    "notes" TEXT,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "lastMatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CounterpartyRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CounterpartyRule_matchType_matchValue_idx" ON "CounterpartyRule"("matchType", "matchValue");

-- AddForeignKey
ALTER TABLE "CounterpartyRule" ADD CONSTRAINT "CounterpartyRule_appCategoryId_fkey" FOREIGN KEY ("appCategoryId") REFERENCES "AppCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
