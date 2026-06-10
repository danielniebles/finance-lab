-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'CREDIT_CARD';

-- AlterTable
ALTER TABLE "SavingsAccount" ADD COLUMN     "creditLimit" DOUBLE PRECISION;
