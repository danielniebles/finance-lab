-- ADR-062: a rule's legacy `wallet` label now always names the Wallet it
-- routes to. Older rules kept whatever label they were created with
-- ("Bancolombia", the message's "Débito *4941", "—").
UPDATE "CounterpartyRule" AS r
SET "wallet" = w."name"
FROM "Wallet" AS w
WHERE r."walletId" = w."id"
  AND r."wallet" IS DISTINCT FROM w."name";
