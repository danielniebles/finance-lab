-- AlterTable
ALTER TABLE "InstallmentPayment" ADD COLUMN     "transactionId" TEXT;

-- AddForeignKey
ALTER TABLE "InstallmentPayment" ADD CONSTRAINT "InstallmentPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

