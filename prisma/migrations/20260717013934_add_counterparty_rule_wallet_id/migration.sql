-- AlterTable
ALTER TABLE "CounterpartyRule" ADD COLUMN     "walletId" TEXT;

-- AddForeignKey
ALTER TABLE "CounterpartyRule" ADD CONSTRAINT "CounterpartyRule_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
