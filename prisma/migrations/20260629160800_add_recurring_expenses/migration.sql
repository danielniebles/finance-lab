-- AlterEnum
ALTER TYPE "VaultGoalType" ADD VALUE 'RECURRING';

-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "estimatedAmount" DOUBLE PRECISION NOT NULL,
    "cadenceMonths" INTEGER NOT NULL,
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "fundingVaultId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringExpensePayment" (
    "id" TEXT NOT NULL,
    "recurringExpenseId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vaultEntryId" TEXT,
    "notes" TEXT,

    CONSTRAINT "RecurringExpensePayment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_fundingVaultId_fkey" FOREIGN KEY ("fundingVaultId") REFERENCES "Vault"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpensePayment" ADD CONSTRAINT "RecurringExpensePayment_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
