-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "channel" TEXT;

-- CreateTable
CREATE TABLE "PendingProposal" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "channel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PendingProposal_pkey" PRIMARY KEY ("id")
);
