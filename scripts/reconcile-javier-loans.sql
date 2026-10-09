-- One-off reconciliation of Javier's "Cuota Javier" loans (ADR-060), run once
-- per database AFTER migrations 20261008120000 and 20261008130000.
--
--   docker exec -i finance-lab-db-1 psql -U financelab -d financelab -v ON_ERROR_STOP=1 < scripts/reconcile-javier-loans.sql
--   psql "$PROD_DIRECT_URL" -v ON_ERROR_STOP=1 < scripts/reconcile-javier-loans.sql
--
-- Changes no wallet balance and no amount owed — it only reshapes and links
-- loans that already exist, leaving one loan per cuota (1/12 to 4/12):
-- 0. Both installments get debtor Javier + funding account Bancolombia, so
--    from cuota 5/12 on "Mark paid" / "Pay all" record his loan by themselves.
-- 1. Jun 29 (cuota 1/12 ×2): two identical loans merged into one. Both are
--    dated before the wallets' opening date, so neither counts in a balance.
-- 2. Aug 9 (cuota 3/12 ×2): the two loans had no wallet; the money left through
--    the "Prestamo papá" transaction. Merged into one loan linked to it.
-- 3. Every Javier slot is linked to its loan (InstallmentPayment.loanId), so
--    unmarking a slot takes its share back out. Cuotas 2/12 and 4/12 were
--    recorded as manual loans (Jul 13 352674, no note; Sep 13 340370 "Cuota 4/12").
--
-- Idempotent: each step checks whether it already ran. Fails (and rolls back
-- everything) if the rows it expects aren't there.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Debtor" WHERE id = 'debtor_javier') THEN
    RAISE EXCEPTION 'Debtor debtor_javier not found';
  END IF;
  IF (SELECT count(*) FROM "Installment"
      WHERE id IN ('cmqz9nb0i0002l704flozue6n', 'cmqz9mgm80002l504jemzeij4')
        AND description = 'Cuota Javier'
        AND ("debtorId" IS NULL OR "debtorId" = 'debtor_javier')) <> 2 THEN
    RAISE EXCEPTION 'Javier''s two installments not found as expected';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "SavingsAccount" WHERE id = 'acc_bancolombia') THEN
    RAISE EXCEPTION 'Account acc_bancolombia not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Transaction" WHERE id = 'cmsl34qv60005jj04i1gm134f' AND amount = -344538) THEN
    RAISE EXCEPTION 'Transaction "Prestamo papá" (Aug 9, -344538) not found';
  END IF;
  IF (SELECT count(*) FROM "Loan"
      WHERE id IN ('cmqz9ukuy0008l504w30l17wf', 'cmrjpnza00003i804x2fh9btq', 'cmu0flxm40001jv04ogvbtnrv')
        AND "debtorId" = 'debtor_javier') <> 3 THEN
    RAISE EXCEPTION 'Javier''s loans for cuotas 1/12, 2/12 and 4/12 not found as expected';
  END IF;
END $$;

-- 0. Javier + Bancolombia on both installments.
UPDATE "Installment" SET "debtorId" = 'debtor_javier', "fundingAccountId" = 'acc_bancolombia'
WHERE id IN ('cmqz9nb0i0002l704flozue6n', 'cmqz9mgm80002l504jemzeij4')
  AND ("debtorId" IS NULL OR "fundingAccountId" IS NULL);

-- 1. Jun 29: merge the two cuota 1/12 loans into the first (skipped once merged).
UPDATE "Loan" SET
  amount = 356424,
  notes = 'Cuota 1/12 — Cuota Javier, Cuota 1/12 — Cuota Javier'
WHERE id = 'cmqz9ukuy0008l504w30l17wf'
  AND EXISTS (SELECT 1 FROM "Loan" WHERE id = 'cmqz9ulph000cl104oyh2nfxw');

UPDATE "LoanPayment" SET "loanId" = 'cmqz9ukuy0008l504w30l17wf'
WHERE "loanId" = 'cmqz9ulph000cl104oyh2nfxw';

DELETE FROM "Loan" WHERE id = 'cmqz9ulph000cl104oyh2nfxw';

-- 2. Aug 9: merge the two cuota 3/12 loans into one linked to "Prestamo papá".
UPDATE "LoanPayment" SET "loanId" = 'cmsl336i80005kz04xhumqv4n'
WHERE "loanId" = 'cmsl339s20003l7049qqmqqfl';

DELETE FROM "Loan" WHERE id = 'cmsl339s20003l7049qqmqqfl';

UPDATE "Loan" SET
  amount = 344520,
  notes = 'Cuota 3/12 — Cuota Javier, Cuota 3/12 — Cuota Javier',
  "walletId" = (SELECT "savingsWalletId" FROM "SavingsAccount" WHERE id = 'acc_bancolombia'),
  "transactionId" = 'cmsl34qv60005jj04i1gm134f'
WHERE id = 'cmsl336i80005kz04xhumqv4n' AND "transactionId" IS NULL;

-- 3. Link each slot to its loan (only slots not linked yet).
UPDATE "InstallmentPayment" SET "loanId" = 'cmqz9ukuy0008l504w30l17wf'
WHERE "installmentId" IN ('cmqz9nb0i0002l704flozue6n', 'cmqz9mgm80002l504jemzeij4')
  AND "installmentNum" = 1 AND "loanId" IS NULL;

UPDATE "InstallmentPayment" SET "loanId" = 'cmrjpnza00003i804x2fh9btq'
WHERE "installmentId" IN ('cmqz9nb0i0002l704flozue6n', 'cmqz9mgm80002l504jemzeij4')
  AND "installmentNum" = 2 AND "loanId" IS NULL;

UPDATE "InstallmentPayment" SET "loanId" = 'cmsl336i80005kz04xhumqv4n'
WHERE "installmentId" IN ('cmqz9nb0i0002l704flozue6n', 'cmqz9mgm80002l504jemzeij4')
  AND "installmentNum" = 3 AND "loanId" IS NULL;

UPDATE "InstallmentPayment" SET "loanId" = 'cmu0flxm40001jv04ogvbtnrv'
WHERE "installmentId" IN ('cmqz9nb0i0002l704flozue6n', 'cmqz9mgm80002l504jemzeij4')
  AND "installmentNum" = 4 AND "loanId" IS NULL;

-- What it left: Javier's slots and the loan each is linked to.
SELECT p."installmentNum", p."paidAt"::date, l.id AS loan, l.amount, l."walletId" IS NOT NULL AS has_wallet,
       l."transactionId" IS NOT NULL AS linked_tx
FROM "InstallmentPayment" p
LEFT JOIN "Loan" l ON l.id = p."loanId"
WHERE p."installmentId" IN ('cmqz9nb0i0002l704flozue6n', 'cmqz9mgm80002l504jemzeij4')
ORDER BY p."paidAt";

COMMIT;
