-- Data-fix migration (no schema change): backfill CounterpartyRule.walletId
-- for every rule left with walletId = NULL by the purely-additive
-- 20260717013934_add_counterparty_rule_wallet_id migration.
--
-- Mirrors the wallets_c1 Transaction.walletId backfill
-- (prisma/migrations/20260709221410_wallets_c1/migration.sql:131-155), but
-- extended with the ADR-040 amendment to resolve-wallet.ts's
-- resolveWalletId()/buildWalletResolver() that landed AFTER that migration
-- was written — this backfill must produce the SAME walletId
-- resolveWalletId() would resolve the rule's legacy `wallet` label to TODAY,
-- not the older (pre-ADR-040) two-tier logic. Resolution order, dynamic
-- against whatever Wallet/SavingsAccount rows exist in the target
-- environment (never hardcoded ids — local dev, staging, and production all
-- have different generated ids):
--   1. exact case-insensitive match of the label against a Wallet.name.
--   2. else, case-insensitive match against a SavingsAccount.name -> that
--      account's defaultWalletId (a label naming the institution, not one
--      of its partitions — e.g. "Bancolombia").
--   3. else (the label matches neither a wallet nor an account at all) ->
--      fall back to the Bancolombia account's defaultWalletId, same
--      catch-all resolveWalletId() applies to an unrecognized label.
--   4. else (even that fallback account/wallet is missing) -> leave NULL.
--
-- Idempotent / safe to re-run: only touches rows that are STILL unassigned,
-- so re-running never clobbers a row that's since been manually reassigned
-- to a different wallet via the settings UI.
DO $$
DECLARE
  rule_wallet TEXT;
  matched_wallet_id TEXT;
  matched_account_default_id TEXT;
  fallback_wallet_id TEXT;
BEGIN
  SELECT "defaultWalletId" INTO fallback_wallet_id
  FROM "SavingsAccount" WHERE lower(name) = 'bancolombia' LIMIT 1;

  FOR rule_wallet IN
    SELECT DISTINCT wallet FROM "CounterpartyRule" WHERE "walletId" IS NULL
  LOOP
    SELECT id INTO matched_wallet_id FROM "Wallet" WHERE lower(name) = lower(rule_wallet) LIMIT 1;

    IF matched_wallet_id IS NOT NULL THEN
      UPDATE "CounterpartyRule" SET "walletId" = matched_wallet_id
      WHERE "walletId" IS NULL AND wallet = rule_wallet;
    ELSE
      SELECT "defaultWalletId" INTO matched_account_default_id
      FROM "SavingsAccount" WHERE lower(name) = lower(rule_wallet) LIMIT 1;

      IF matched_account_default_id IS NOT NULL THEN
        UPDATE "CounterpartyRule" SET "walletId" = matched_account_default_id
        WHERE "walletId" IS NULL AND wallet = rule_wallet;
      ELSIF fallback_wallet_id IS NOT NULL THEN
        UPDATE "CounterpartyRule" SET "walletId" = fallback_wallet_id
        WHERE "walletId" IS NULL AND wallet = rule_wallet;
      END IF;
    END IF;

    matched_wallet_id := NULL;
    matched_account_default_id := NULL;
  END LOOP;
END $$;
