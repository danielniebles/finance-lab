-- Data-fix migration (no schema change): backfill Transaction.walletId for
-- legacy "Debit Card"-labeled rows left unassigned by the wallets_c1
-- migration's name-matching backfill (prisma/migrations/20260709221410_wallets_c1/migration.sql:139-155).
-- That backfill only matches the legacy `wallet` label against a Wallet/SavingsAccount
-- NAME (case-insensitive) — "Debit Card" is a MoneyLover payment-method label, not an
-- institution/partition name, so none of it matched and all 403 rows were left
-- walletId = NULL.
--
-- Confirmed with Daniel: "Debit Card" means day-to-day Bancolombia debit spending in
-- his real usage, i.e. Bancolombia's `debit/daily` wallet.
--
-- Idempotent / safe to re-run: only touches rows that are STILL unassigned AND STILL
-- carry the legacy "Debit Card" label, so re-running never clobbers a row that's since
-- been manually reassigned or edited to a different wallet.
UPDATE "Transaction" AS t
SET "walletId" = w.id
FROM "Wallet" AS w
JOIN "SavingsAccount" AS a ON a.id = w."accountId"
WHERE t."walletId" IS NULL
  AND lower(t.wallet) = 'debit card'
  AND lower(a.name) = 'bancolombia'
  AND lower(w.name) = 'debit/daily';
