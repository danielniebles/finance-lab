-- CreateEnum
CREATE TYPE "VaultKind" AS ENUM ('MANDATORY', 'LEISURE');

-- CreateEnum
CREATE TYPE "VaultGoalType" AS ENUM ('FIXED_DEADLINE', 'OPEN_ENDED');

-- CreateTable
CREATE TABLE "Vault" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "VaultKind" NOT NULL DEFAULT 'LEISURE',
    "goalType" "VaultGoalType" NOT NULL DEFAULT 'FIXED_DEADLINE',
    "targetAmount" DOUBLE PRECISION,
    "targetDate" TIMESTAMP(3),
    "color" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultEntry" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vault_name_key" ON "Vault"("name");

-- AddForeignKey
ALTER TABLE "VaultEntry" ADD CONSTRAINT "VaultEntry_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
