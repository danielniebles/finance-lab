-- AlterTable
ALTER TABLE "VaultEntry" ADD COLUMN     "sourceAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "VaultEntry" ADD CONSTRAINT "VaultEntry_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "SavingsAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
