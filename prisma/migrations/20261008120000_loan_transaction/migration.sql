-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "transactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Loan_transactionId_key" ON "Loan"("transactionId");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
