-- Read-only preview for migration 20261006120000_recurring_expense_category.
-- Shows, for every recurring expense, whether its free-text category will be
-- linked to an existing category ("will link") or stay unlinked.
-- Run before `prisma migrate`, e.g.:
--   docker compose exec -T db psql -U financelab -d financelab < scripts/recurring-category-dry-run.sql
SELECT
  r."name"                              AS expense,
  r."category"                          AS current_label,
  c."name"                              AS links_to,
  CASE
    WHEN r."category" IS NULL THEN 'no label (stays empty)'
    WHEN c."id" IS NULL       THEN 'no match (label kept, unlinked)'
    ELSE 'will link'
  END                                   AS result
FROM "RecurringExpense" r
LEFT JOIN "AppCategory" c
  ON c."isTransfer" = false
 AND lower(btrim(r."category")) = lower(btrim(c."name"))
WHERE r."active" = true
ORDER BY result, r."name";
