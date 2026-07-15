-- AlterTable
ALTER TABLE "VaultEntry" ADD COLUMN     "transactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "VaultEntry_transactionId_key" ON "VaultEntry"("transactionId");

-- AddForeignKey
ALTER TABLE "VaultEntry" ADD CONSTRAINT "VaultEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
