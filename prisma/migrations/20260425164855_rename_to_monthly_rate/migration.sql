/*
  Warnings:

  - You are about to drop the column `annualInterestRate` on the `Installment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Installment" DROP COLUMN "annualInterestRate",
ADD COLUMN     "monthlyInterestRate" DOUBLE PRECISION;
