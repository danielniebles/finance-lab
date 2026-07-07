# Backlog

## Known issues
- `next-themes` is listed as a dependency (`package.json`) but is not used — theme is managed via a plain cookie mechanism instead. The package can be removed.
- `@anthropic-ai/sdk` and the `@googleapis/drive` packages are production dependencies, which means they are bundled for the server but not tree-shaken. This is acceptable for a server-rendered app but worth noting if bundle size ever matters.
- ✅ RESOLVED (ADR-029) — The chat history window loads the most-recent 20 messages (`desc + take: 20`, reversed), not the 20 oldest. Two follow-on ideas from the same investigation are still open, not yet built:
  1. **Time-bounded window** — additionally filter to messages within a recent window (e.g. ~2 hours), so a stale topic drops off instead of bleeding into a new one once 20 messages haven't yet been reached.
  2. **Reset keyword** — a `reset`/`nuevo` keyword that starts a fresh context (ignores history before it), for when the user deliberately switches topics.

## TODO items from code
No `TODO` or `FIXME` comments were found in the source.

## Unfinished features

**Playwright tests**
`@playwright/test` and `playwright` are listed as dev dependencies, suggesting E2E tests were planned. No test files were found anywhere in the project.

**Trends page period selector**
The trends page reads a `?period` search param (3, 6, or 12) but the `TrendsDashboard` component is the one that should expose the period toggle UI. Whether this control is already rendered inside `TrendsDashboard` or still missing is not visible from the page file alone.

**`expenses.ts` actions file**
`src/lib/actions/expenses.ts` exists but its contents were not explored — it may contain additional server actions beyond the import flow.

## Future improvements

### Component organization — deferred cross-module items (from 2026-07-02 review)

These patterns were identified during a finance-lab component organization review and are intentionally deferred; revisit during the next feature pass in each module.

- **`vaults/entry-form.tsx` rename** — rename to `vault-entry-form.tsx` (mirrors the loans/account-entry-form.tsx rename already applied). Caller: `vaults/vaults-dashboard.tsx` and/or `vaults/page.tsx`.
- **`installments/` forms — `useActionState` migration** — `installment-form.tsx` and any other installments forms still use manual `useState` + `useTransition`; migrate to React 19 `useActionState` + `useFormStatus` once the loans forms are done (see below).
- **`vaults/` forms — `useActionState` migration** — `vault-form.tsx`, `entry-form.tsx`, `recurring-expense-form.tsx` use manual `useState` + `useTransition`; migrate to React 19 pattern.
- **`installments/` folder growth** — at 9 files (threshold is ~8–10); add `hooks/` + `lib/` subfolders when the next hook is extracted from `installment-form.tsx`.
- **Pattern to check in future reviews** — when reviewing any feature folder: (a) check for inline colour palettes duplicated across feature files → extract to `src/lib/color-presets.ts`; (b) check for file-per-constant → consolidate into `lib/constants.ts`; (c) check that hooks live in `hooks/` and helpers in `lib/` subfolders once folder exceeds ~8–10 files; (d) check for form state using `useState`+`useTransition` instead of `useActionState`/`useFormStatus`; (e) check for ambiguous filenames shared across feature folders.

---



### AI Advisor + Vaults — Vaults in Health Score (low effort, medium value)

The `getHealthScore()` metric uses four pillars (Savings Rate, Variable Burn Rate, Installment Burden, Liquidity Ratio). Vault obligations could add a fifth pillar: **Vault Funding Rate** = mandatory vault contributions made / mandatory vault obligations due × 100. Not yet implemented — Health Score still uses only the original four.

---

### AI Advisor + Vaults — Global vault obligations banner (low effort)

`VaultDueBanner` is currently mounted only on `/overview`. It could also appear on `/vaults` when the user is looking at their vaults page and still has obligations. Minor duplication — one mount point vs. two.

---

- **Prompt caching:** The AI advisor sends context and history on every call. Adding `cache_control: { type: "ephemeral" }` on stable system prompt blocks could reduce Claude API costs for the repeated prefix across turns.
- **Category mapping UI:** Currently, unmapped MoneyLover categories are shown as a count with a link to the mappings settings page. An inline mapping shortcut on the expenses dashboard would speed up the post-import workflow.
- **Import from Drive — auto-detect latest:** The Drive integration lists files and requires manual selection. An "import latest" button that automatically picks the most-recently-modified file would reduce clicks.
- **Installment interest rate display:** The installment form accepts a monthly interest rate but the dashboard does not prominently display the total interest cost over the installment's life. Showing `total interest = sum(interest_k for k in 1..n)` would help the user evaluate purchases.
- **Loan age warnings:** The loans UI already computes loan age but any "overdue" alerting relies on `expectedBy` being set. A fallback warning for loans over N days old with no `expectedBy` would surface forgotten debts.
- **Multi-currency / multi-user:** The app is explicitly single-user and COP-only. No architecture changes are needed for these until explicitly requested.

---

### Credit Cards + Installment–Loan bridge (high value, medium-large effort) — partially implemented

**Mental model (important):**
- **Loans module** = liquidity tracker. Savings accounts + money owed TO Daniel by debtors. Credit cards must NOT appear here — they are bank debt, not a savings vehicle.
- **Installments module** = obligations tracker. What Daniel owes the bank, month by month, card by card.

**Feature 1 — Credit card management in Installments** ✅ DONE

Implemented: `CreditCard` model (`prisma/schema.prisma`), `Installment` new FKs (`cardId`, `debtorId`, `fundingAccountId`), `CreditCardTile` + `CreditCardManager` components, per-card filter in `InstallmentsDashboard` (now a `"use client"` component), `getCardSummaries()` query, CreditCard CRUD server actions (`createCard`, `updateCard`, `deleteCard`). See ADR-013 for the `prisma.config.ts` directUrl fix required to run the migration.

**Feature 2 — Auto-create Loan records when paying a debtor-linked installment**

⬜ Still pending. The `markPayment` action already auto-creates a `Loan` record when both `debtorId` and `fundingAccountId` are set — the bridge logic is in place. What remains is full end-to-end validation and any UI feedback (toast showing which debtor received the auto-loan).

---

**Original feature spec below (for reference):**

**Feature 1 — Credit card management in Installments (original spec)**

New `CreditCard` model (lives in the Installments domain):
```prisma
model CreditCard {
  id                String        @id @default(cuid())
  name              String        @unique   // "Nu", "Rappi", "Falabella"
  creditLimit       Float?
  billingClosingDay Int?          // day of month billing cycle closes (e.g. 28)
  paymentDueDay     Int?          // day of month payment is due (e.g. 10)
  color             String?
  installments      Installment[]
}
```

`Installment` model additions:
```prisma
model Installment {
  // existing fields...
  cardId           String?         // FK → CreditCard (optional)
  card             CreditCard?     @relation(...)
  debtorId         String?         // FK → Debtor (optional — who this was bought for)
  debtor           Debtor?         @relation(...)
  fundingAccountId String?         // FK → SavingsAccount (e.g. Bancolombia — only when debtorId is set)
  fundingAccount   SavingsAccount? @relation(...)
}
```

**Installments module UI changes:**
- New "Cards" section at the top: one card per `CreditCard`, showing:
  - Total outstanding debt (sum of remaining balances across all linked installments)
  - Monthly obligation for the current month (sum of `computeInstallmentDue(k)` for each active installment on this card)
  - Next payment due date (derived from `paymentDueDay`)
  - Installment count
- `InstallmentForm`: add optional card picker, optional debtor picker, optional funding account picker (shown only when debtor is selected)
- Card CRUD: create/edit/delete credit cards (separate from the Installments CRUD)

**Feature 2 — Auto-create Loan records when paying a debtor-linked installment**

When a cuota is marked as paid AND the installment has `debtorId` set:
- Server action `payInstallment()` auto-creates a `Loan` record:
  - `debtorId` = the linked debtor
  - `accountId` = `fundingAccountId` (e.g. Bancolombia — the account that actually disbursed the cash)
  - `amount` = `computeInstallmentDue(total, n, k, rate)` (actual cuota amount)
  - `date` = payment date
  - `notes` = auto-filled: "Cuota k/n — [installment description]"
- The debtor's total owed in the Loans module accumulates month by month as cuotas are paid
- No manual `Loan` record creation needed for credit card purchases

**What this replaces / clarifies:**
- The `CREDIT_CARD` AccountType added to `SavingsAccount` and then reverted (migrations `20260608151001` + `20260608200000`) was the wrong approach. Credit cards are NOT savings accounts.
- The `Loan` model is NOT used to record the full 1.7m upfront. Only paid cuotas are recorded as loans, since that's the actual cash disbursed.
- The `fundingAccountId` points to a savings account (Bancolombia, Nequi, etc.) — the account Daniel paid from — not a credit card.

**Cross-module Debtor relation:**
`Debtor` currently lives in the Loans module. The `Installment.debtorId` FK creates a cross-module reference. This is intentional: a debtor is a named person, and the same person appears in both contexts (formal cash loans via Loans module, credit-funded purchases via Installments module).

**Supabase migration note:**
Before building this feature, apply the two pending revert migrations (`20260608151001` + `20260608200000`) to Supabase production via `prisma migrate deploy` with the production DATABASE_URL.

---

### Agent — proactive action-card triggers (medium/large effort, deferred)

**Context:** Today action cards fire *only inside a chat turn* — when the model calls a proposal tool while responding to a message. The agent has no background process and does not observe the database, so a direct UI action (e.g. registering a prima as a `SavingsAccount` entry) never triggers a card on its own. The card only appears when the user next talks to the agent, or clicks an "Ask the agent" button on a deterministic banner that links into a pre-seeded chat.

**Open question (deferred during Phase B scoping):** how proactive should the moment-of-action be? Three levels, increasing cost:

1. **Banner + chat (current Phase B plan).** Saving the entry changes nothing instantly; a deterministic Overview/Income banner surfaces "income waiting to allocate" and the user clicks into a pre-seeded chat. No background agent. Lowest cost — already specified in `.handoff/income-allocation/HANDOFF.md`.
2. **Point-of-action prompt.** After saving a positive savings entry that matches an expected `IncomeEvent`, the savings form shows an inline "This looks like your June prima — allocate it?" that opens the agent pre-seeded with that entry. User-initiated but triggered at the exact moment of the action. Moderate cost: a hook on the savings entry form + the reconciliation match available client-side.
3. **Auto-generated card outside chat.** Saving the entry fires the agent automatically and drops an allocation card into a notifications/inbox surface, visible even with chat closed. Most proactive, but requires two new capabilities the current architecture lacks: the agent running *outside* a chat request cycle, and action cards living *outside* the chat thread (a card store + an inbox UI + an approve path independent of the chat stream).

**Recommendation:** ship Phase B with level 1, then evaluate level 2 as a cheap upgrade once the reconciliation matching exists. Level 3 is a broader "proactive agent" capability worth its own design pass (overlaps with any future scheduled-briefing feature, since both need the agent to run and surface cards without an open chat).

This generalizes beyond primas: the same trigger question applies to recurring-expense due dates, vault shortfalls, and any future "the app noticed something and wants to propose an action" moment.

---

### Forecasting — mid-month pacing ✅ SHIPPED (ADR-024)

`ImportBatch.status` (IN_PROGRESS / FINAL) added via migration `add_import_batch_status`. `getForecast()` now returns pacing-mode fields (`pacingMode`, `spentSoFar`, `projectedVariableSpend`, `daysElapsed`, `daysInMonth`) when an IN_PROGRESS batch exists for the target month. `getTrends()` and `getHealthScore()` exclude IN_PROGRESS batches. `getMonthlyAnalysis()` includes them and returns `isInProgress: true` for UI badging.

**Deferred / open items from this domain:**
- **Voucher OCR** — photographing receipts to auto-categorize without MoneyLover export. Requires a separate ingestion pipeline.
- ✅ SHIPPED (ADR-030/031) — **One-off/bot expense logger.** `propose_add_transaction` + `createTransaction()` record a MANUAL transaction directly (Telegram, Shortcut ingest, or typed chat), with the category editable on the action card instead of a separate mapping UI. MoneyLover import now backfills around it (dedup by day+amount).

---

### First-class Wallet/Account model (deferred — out of scope for the transactions milestone)

`Transaction.wallet` is a plain string label (e.g. "Bancolombia", "Nequi") populated from MoneyLover wallet names or from a bot-parsed bank notification. It is **not** modeled as an entity and has no relation to `SavingsAccount` — a transaction's wallet and a savings account of the same name are two unconnected strings today.

**What's missing:** a first-class Wallet/Account model that represents the user's actual MoneyLover wallets (salary, savings, investments) as entities owning transactions, reconciled with the existing `SavingsAccount` liquidity tracker. Needed for: true balance-per-wallet (not just category-level expense analysis), full parity with MoneyLover's own per-wallet view, and eventually letting a bot-captured transaction affect the right account's computed balance if that's ever desired (today it deliberately does not — ADR-030's "expense record only, no balance coupling" decision).

**Why deferred:** the transactions milestone (ADR-030/031) explicitly scoped this out — the wallet-as-string-label approach was sufficient to ship bot-primary capture without touching the Loans/liquidity model, and folding wallet identity into `SavingsAccount` (or a new entity) is a real modeling decision (which wallets map to which accounts, what happens to existing MoneyLover wallet names that don't correspond to any tracked account, whether/how a MANUAL transaction should ever affect a balance) that deserves its own design pass rather than being bolted on here.

---

### Backend layer — findings from 2026-07-03 review (measured against the `backend-nextjs` standard)

Identified while writing the shared backend-layer standard; recorded here so the tech-lead picks them up on the next backend pass in this repo. Address opportunistically as each file is touched (touch-it-clean-it), not as a big-bang refactor.

- **Server actions lack Zod validation (highest-value gap).** No `lib/actions/*` file validates its input with a schema. A `"use server"` action is a public POST endpoint, so each should parse/validate input at the top and infer its input type from that schema. Add per action as it's touched.
- **✅ RESOLVED (2026-07-04) — `src/lib/agent/run-agent-turn.ts` god-file split.** Was a 1,242-line file mixing tool dispatch, proposal resolution, formatting, and turn orchestration. Split into `agent/tools.ts` (TOOLS schema array), `agent/read-tools.ts` (read-tool dispatch registry), `agent/formatting.ts` (title/field formatting), `agent/proposals/{shared,drive,installments,loans,undo,index}.ts` (complex resolvers + `RESOLVER_REGISTRY` dispatch, mirroring `PROPOSAL_ACTIONS`'s registry shape), leaving `run-agent-turn.ts` (~250 lines) as the thin tool-use-loop orchestrator. The `resolve*` "validate → fetch → build result" shape is now factored into `buildResolvedProposal()`/`blockingProposal()` in `proposals/shared.ts`. Behavior-preserving: the 96-test characterization suite (`run-agent-turn.test.ts`) passed unmodified in assertions, only import paths updated. Reviewer follow-up applied: the test now imports every resolver via the `proposals` barrel (not per-domain files) to match production, and a new test asserts `RESOLVER_REGISTRY`'s keys stay a subset of `PROPOSAL_ACTIONS`'s.
- **Inconsistent error handling.** Actions mix thrown errors with ad-hoc `{ error }` returns. Converge on one contract (a typed result *or* throw-to-`error.tsx`), and never leak DB/internal error detail to the client — map to a safe message and log the detail server-side.
- **Revalidation is on the pre-16 model.** `revalidatePath` is used throughout (~56 call sites). When adopting the Next 16 caching model, migrate to tag-based `cacheTag`/`updateTag`. Not urgent — do it as one deliberate caching migration, not piecemeal.
- **Auth / user-scoping — intentionally absent** while the app is single-user (see the multi-currency / multi-user note above). When multi-user is ever introduced, every action and query must authenticate and scope to the owning user; an unscoped query becomes a data leak at that point.
