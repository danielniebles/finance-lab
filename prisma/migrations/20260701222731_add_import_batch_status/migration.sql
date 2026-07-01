-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('IN_PROGRESS', 'FINAL');

-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN     "status" "BatchStatus" NOT NULL DEFAULT 'FINAL';
