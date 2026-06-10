-- AlterEnum
BEGIN;
CREATE TYPE "AccountType_new" AS ENUM ('BANK', 'DIGITAL', 'PENSION');
ALTER TABLE "SavingsAccount" ALTER COLUMN "accountType" TYPE "AccountType_new" USING ("accountType"::text::"AccountType_new");
ALTER TYPE "AccountType" RENAME TO "AccountType_old";
ALTER TYPE "AccountType_new" RENAME TO "AccountType";
DROP TYPE "public"."AccountType_old";
COMMIT;

-- AlterTable
ALTER TABLE "SavingsAccount" DROP COLUMN "creditLimit";
