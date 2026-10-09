-- AlterTable
ALTER TABLE "InstallmentPayment" ADD COLUMN     "loanId" TEXT;

-- AlterTable
ALTER TABLE "LoanPayment" ADD COLUMN     "transactionId" TEXT;

-- AddForeignKey
ALTER TABLE "InstallmentPayment" ADD CONSTRAINT "InstallmentPayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Loans and repayments are moves of your own money, not spending or income
-- (ADR-060): the "Loans" category and its transactions count as transfers.
UPDATE "AppCategory" SET "isTransfer" = true WHERE name = 'Loans';
UPDATE "Transaction" SET "isTransfer" = true
WHERE "appCategoryId" IN (SELECT id FROM "AppCategory" WHERE name = 'Loans');
