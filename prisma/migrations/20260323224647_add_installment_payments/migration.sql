/*
  Warnings:

  - You are about to drop the column `installmentsPaid` on the `Installment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Installment" DROP COLUMN "installmentsPaid";

-- CreateTable
CREATE TABLE "InstallmentPayment" (
    "id" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "installmentNum" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallmentPayment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InstallmentPayment" ADD CONSTRAINT "InstallmentPayment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
