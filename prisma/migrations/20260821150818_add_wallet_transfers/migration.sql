-- AlterTable
ALTER TABLE "AppCategory" ADD COLUMN     "isTransfer" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "isTransfer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transferPairId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_transferPairId_idx" ON "Transaction"("transferPairId");

-- Seed the two wallet-transfer categories createWalletTransfer looks up by
-- name. ON CONFLICT guards a re-run (e.g. `prisma migrate dev` on a DB where
-- these were already inserted by hand).
INSERT INTO "AppCategory" (id, name, "isTransfer")
VALUES
  ('cat_transferout', 'Outgoing Transfer', true),
  ('cat_transferin',  'Incoming Transfer', true)
ON CONFLICT (name) DO NOTHING;
