-- Drop existing Module 3 tables (empty at this point)
DROP TABLE IF EXISTS "LoanPayment";
DROP TABLE IF EXISTS "Loan";
DROP TABLE IF EXISTS "Debtor";
DROP TABLE IF EXISTS "SavingsAccount";
DROP TYPE IF EXISTS "LoanStatus";

-- New enums
CREATE TYPE "AccountType" AS ENUM ('BANK', 'DIGITAL', 'PENSION');
CREATE TYPE "EntryType"   AS ENUM ('INITIAL', 'ADJUSTMENT');

-- SavingsAccount
CREATE TABLE "SavingsAccount" (
    "id"                 TEXT    NOT NULL,
    "name"               TEXT    NOT NULL,
    "accountType"        "AccountType" NOT NULL,
    "color"              TEXT,
    "includeInAvailable" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "SavingsAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SavingsAccount_name_key" ON "SavingsAccount"("name");

-- AccountEntry
CREATE TABLE "AccountEntry" (
    "id"        TEXT               NOT NULL,
    "accountId" TEXT               NOT NULL,
    "type"      "EntryType"        NOT NULL,
    "amount"    DOUBLE PRECISION   NOT NULL,
    "date"      TIMESTAMP(3)       NOT NULL,
    "notes"     TEXT,
    CONSTRAINT "AccountEntry_pkey" PRIMARY KEY ("id")
);

-- Transfer
CREATE TABLE "Transfer" (
    "id"            TEXT             NOT NULL,
    "fromAccountId" TEXT             NOT NULL,
    "toAccountId"   TEXT             NOT NULL,
    "amount"        DOUBLE PRECISION NOT NULL,
    "date"          TIMESTAMP(3)     NOT NULL,
    "notes"         TEXT,
    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- Debtor
CREATE TABLE "Debtor" (
    "id"    TEXT NOT NULL,
    "name"  TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "Debtor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Debtor_name_key" ON "Debtor"("name");

-- Loan
CREATE TABLE "Loan" (
    "id"         TEXT             NOT NULL,
    "debtorId"   TEXT             NOT NULL,
    "accountId"  TEXT             NOT NULL,
    "amount"     DOUBLE PRECISION NOT NULL,
    "date"       TIMESTAMP(3)     NOT NULL,
    "expectedBy" TIMESTAMP(3),
    "notes"      TEXT,
    "createdAt"  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- LoanPayment
CREATE TABLE "LoanPayment" (
    "id"     TEXT             NOT NULL,
    "loanId" TEXT             NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date"   TIMESTAMP(3)     NOT NULL,
    "notes"  TEXT,
    CONSTRAINT "LoanPayment_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "SavingsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromAccountId_fkey"
    FOREIGN KEY ("fromAccountId") REFERENCES "SavingsAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toAccountId_fkey"
    FOREIGN KEY ("toAccountId") REFERENCES "SavingsAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Loan" ADD CONSTRAINT "Loan_debtorId_fkey"
    FOREIGN KEY ("debtorId") REFERENCES "Debtor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Loan" ADD CONSTRAINT "Loan_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "SavingsAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_loanId_fkey"
    FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
