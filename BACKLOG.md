# Finance Lab — Backlog

Ideas and deferred features with enough context to pick up later.

---

## Installments — Provision / Salary-split tracking

**Problem**
The user sometimes funds a single installment across two salary cycles — e.g. saves half from month N's salary and pays the rest from month N+1. The installment module currently only models the creditor side (paid / not paid on a given date). It has no concept of "I earmarked $X from last month's salary toward this future payment."

This means the "due this month" obligation always shows the full installment amount even when part of it was already provisioned the previous month — making that month look more expensive than it actually is, and the previous month look like it had more free cash.

**Proposed solution**
New model: `InstallmentProvision { id, installmentId, month, year, amount }`  
Same shape as `InstallmentPayment` but represents money *set aside* rather than money *paid*.

The monthly summary would then expose two numbers:
- **Due** — what the creditor receives (existing)
- **Provision** — what you're earmarking this month toward future installments (new)
- **Total cash commitment** = due + provision

**Why deferred**
Low urgency while installment count stays at 1–2 active at a time. The mental overhead of tracking provisions manually is manageable at that scale. Worth revisiting if the number of concurrent installments grows or cash flow planning becomes harder to do mentally.

**Files that would be touched**
- `prisma/schema.prisma` — new `InstallmentProvision` model + migration
- `src/lib/actions/installments.ts` — `createProvision`, `deleteProvision`
- `src/lib/queries/installments.ts` — include provisions in `getMonthSummary`
- `src/components/installments/installments-dashboard.tsx` — provision row in monthly summary
- New component: provision entry UI in the "due this month" table

---
