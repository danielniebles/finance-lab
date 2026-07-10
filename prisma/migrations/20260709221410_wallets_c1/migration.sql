-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSavings" BOOLEAN NOT NULL DEFAULT true,
    "includeInAvailable" BOOLEAN NOT NULL DEFAULT true,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openingDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "SavingsAccount" ADD COLUMN     "defaultWalletId" TEXT,
ADD COLUMN     "savingsWalletId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "walletId" TEXT;

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "walletId" TEXT;

-- AlterTable
ALTER TABLE "VaultEntry" ADD COLUMN     "sourceWalletId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_accountId_name_key" ON "Wallet"("accountId", "name");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SavingsAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsAccount" ADD CONSTRAINT "SavingsAccount_savingsWalletId_fkey" FOREIGN KEY ("savingsWalletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsAccount" ADD CONSTRAINT "SavingsAccount_defaultWalletId_fkey" FOREIGN KEY ("defaultWalletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultEntry" ADD CONSTRAINT "VaultEntry_sourceWalletId_fkey" FOREIGN KEY ("sourceWalletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Data migration (ADR-036/037, Milestone C1 — see .handoff/wallets-model/HANDOFF.md §2)
--
-- For every SavingsAccount, create its Wallet partition(s), point
-- savingsWalletId/defaultWalletId, and attribute existing Loan/VaultEntry
-- rows to the account's savings wallet. Each wallet's openingBalance is the
-- account's balance computed via the EXACT pre-migration getLoansOverview
-- formula (entries + transfersIn - transfersOut - loansGiven + loanPayments
-- - vaultFunded), and openingDate is this migration's timestamp — so
-- Σ post-epoch flows = 0 on day 0 and every balance (and the grand total)
-- is continuous across the migration (ADR-037).
--
-- Bancolombia (matched by exact name, the only institution Daniel has
-- described as split — HANDOFF "Real structure") gets its 3 real partitions
-- instead of one default wallet: debit/daily (isSavings=false — spending,
-- out of the Loans surface), savings (isSavings=true,
-- includeInAvailable=true), investments (isSavings=true,
-- includeInAvailable=false — long-term/illiquid, HANDOFF open question #3).
-- Real debit/investments balances are unknown (HANDOFF open question #1), so
-- the whole current balance is parked in the savings wallet as a
-- placeholder — this keeps the grand total, the savings figure, AND the
-- liquidity KPI all reconciling on day 0; only the sub-split is provisional
-- until Daniel supplies real numbers.
--
-- Every other SavingsAccount (Nu, Rappi, Protección, and any other — e.g. a
-- second, differently-named "Bancolombia Main" account present in this
-- database that is NOT literally named "Bancolombia" — see backend team
-- request) gets exactly one default wallet named after the account, with
-- includeInAvailable inherited from the account's pre-migration flag
-- (Protección -> false, others -> true), and both savingsWalletId and
-- defaultWalletId pointing at it.
DO $$
DECLARE
  acct RECORD;
  bal DOUBLE PRECISION;
  now_ts TIMESTAMP(3) := NOW();
  default_wallet_id TEXT;
  debit_wallet_id TEXT;
  savings_wallet_id TEXT;
  invest_wallet_id TEXT;
  matched_wallet_id TEXT;
  matched_account_default_id TEXT;
  txn_wallet TEXT;
BEGIN
  FOR acct IN SELECT * FROM "SavingsAccount" ORDER BY name LOOP
    SELECT
        COALESCE((SELECT SUM(amount) FROM "AccountEntry" WHERE "accountId" = acct.id), 0)
      + COALESCE((SELECT SUM(amount) FROM "Transfer" WHERE "toAccountId" = acct.id), 0)
      - COALESCE((SELECT SUM(amount) FROM "Transfer" WHERE "fromAccountId" = acct.id), 0)
      - COALESCE((SELECT SUM(amount) FROM "Loan" WHERE "accountId" = acct.id), 0)
      + COALESCE((SELECT SUM(lp.amount) FROM "LoanPayment" lp JOIN "Loan" l ON lp."loanId" = l.id WHERE l."accountId" = acct.id), 0)
      - COALESCE((SELECT SUM(amount) FROM "VaultEntry" WHERE "sourceAccountId" = acct.id), 0)
    INTO bal;

    IF acct.name = 'Bancolombia' THEN
      debit_wallet_id := 'wlt_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20);
      INSERT INTO "Wallet" (id, "accountId", name, "sortOrder", "isSavings", "includeInAvailable", "openingBalance", "openingDate")
      VALUES (debit_wallet_id, acct.id, 'debit/daily', 0, false, true, 0, now_ts);

      savings_wallet_id := 'wlt_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20);
      INSERT INTO "Wallet" (id, "accountId", name, "sortOrder", "isSavings", "includeInAvailable", "openingBalance", "openingDate")
      VALUES (savings_wallet_id, acct.id, 'savings', 1, true, true, bal, now_ts);

      invest_wallet_id := 'wlt_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20);
      INSERT INTO "Wallet" (id, "accountId", name, "sortOrder", "isSavings", "includeInAvailable", "openingBalance", "openingDate")
      VALUES (invest_wallet_id, acct.id, 'investments', 2, true, false, 0, now_ts);

      UPDATE "SavingsAccount" SET "savingsWalletId" = savings_wallet_id, "defaultWalletId" = debit_wallet_id WHERE id = acct.id;
      UPDATE "Loan" SET "walletId" = savings_wallet_id WHERE "accountId" = acct.id;
      UPDATE "VaultEntry" SET "sourceWalletId" = savings_wallet_id WHERE "sourceAccountId" = acct.id;
    ELSE
      default_wallet_id := 'wlt_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20);
      INSERT INTO "Wallet" (id, "accountId", name, "sortOrder", "isSavings", "includeInAvailable", "openingBalance", "openingDate")
      VALUES (default_wallet_id, acct.id, acct.name, 0, true, acct."includeInAvailable", bal, now_ts);

      UPDATE "SavingsAccount" SET "savingsWalletId" = default_wallet_id, "defaultWalletId" = default_wallet_id WHERE id = acct.id;
      UPDATE "Loan" SET "walletId" = default_wallet_id WHERE "accountId" = acct.id;
      UPDATE "VaultEntry" SET "sourceWalletId" = default_wallet_id WHERE "sourceAccountId" = acct.id;
    END IF;
  END LOOP;

  -- Backfill Transaction.walletId from the legacy `wallet` string label,
  -- mirroring the write-path resolver rule (HANDOFF §3b): match a Wallet by
  -- name (case-insensitive) first; else match a SavingsAccount by name and
  -- fall back to its defaultWalletId; else leave null. Harmless for balances
  -- either way — every existing transaction predates openingDate, so the
  -- ADR-037 epoch guard means it contributes 0 to any wallet's balance
  -- regardless of walletId; this only affects future wallet-grouped
  -- historical browsing.
  FOR txn_wallet IN SELECT DISTINCT wallet FROM "Transaction" LOOP
    SELECT id INTO matched_wallet_id FROM "Wallet" WHERE lower(name) = lower(txn_wallet) LIMIT 1;

    IF matched_wallet_id IS NOT NULL THEN
      UPDATE "Transaction" SET "walletId" = matched_wallet_id WHERE wallet = txn_wallet;
    ELSE
      SELECT "defaultWalletId" INTO matched_account_default_id
      FROM "SavingsAccount" WHERE lower(name) = lower(txn_wallet) LIMIT 1;

      IF matched_account_default_id IS NOT NULL THEN
        UPDATE "Transaction" SET "walletId" = matched_account_default_id WHERE wallet = txn_wallet;
      END IF;
    END IF;

    matched_wallet_id := NULL;
    matched_account_default_id := NULL;
  END LOOP;
END $$;

-- Drop the account-level flag now that every account has a wallet carrying
-- its own includeInAvailable (the flag moves down to Wallet — ADR-036). Must
-- run AFTER the data migration above, which reads this column.
ALTER TABLE "SavingsAccount" DROP COLUMN "includeInAvailable";
