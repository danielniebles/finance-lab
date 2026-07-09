# Decisions

## ADR-001 — Next.js 15 App Router with async Server Components

**Decision:** All pages are async React Server Components in the `(app)` route group. DB queries are called directly inside Server Components (no internal API routes for data fetching). Every page that queries the database exports `export const dynamic = "force-dynamic"` to opt out of static rendering. Client mutations use Next.js Server Actions.

**Why:** Eliminates the `useEffect + fetch + useState` pattern. Server Components can `await` Prisma directly, and `revalidatePath` refreshes data without client-side fetch wiring. force-dynamic is required because all data is user-specific and changes on every import.

---

## ADR-002 — PostgreSQL + Prisma ORM

**Decision:** PostgreSQL is the database, accessed via Prisma Client generated into `src/generated/prisma/`. The schema lives in `prisma/schema.prisma`. Migrations use `prisma migrate dev`. The Prisma client singleton is exported from `src/lib/db.ts`.

**Why:** Prisma provides type-safe queries and a reliable migration workflow. The generated client is placed in `src/generated/` rather than `node_modules/.prisma/` to keep it visible in the repo and compatible with the build pipeline across environments (Windows dev + Docker Compose + Vercel/Supabase).

**Binary targets:** The schema specifies `["native", "windows", "linux-musl-openssl-3.0.x", "rhel-openssl-3.0.x"]` to cover local Windows dev, Docker Compose (musl), and the Vercel/Supabase production environment (RHEL).

---

## ADR-003 — shadcn/ui base-nova style (Base UI instead of Radix)

**Decision:** The project uses the `base-nova` variant of shadcn/ui which wraps `@base-ui/react` internally instead of Radix UI. This changes two APIs: components use a `render` prop instead of `asChild` for composition, and `Select.onValueChange` receives `(value: string | null, eventDetails)` — callers must guard against null.

**Why:** base-nova is the newer, actively-maintained shadcn direction with better accessibility primitives via Base UI. The API differences are small but must be respected to avoid broken composition.

---

## ADR-004 — Tailwind CSS v4 with tw-animate-css

**Decision:** Tailwind v4 is used with the PostCSS plugin (`@tailwindcss/postcss`). Animation utilities come from `tw-animate-css`. Theme tokens are defined in `globals.css` using CSS custom properties.

**Why:** Tailwind v4 removes the config file requirement and moves theme tokens to CSS. This project was initialized on v4 so no migration burden; the approach is idiomatic for the version.

---

## ADR-005 — MoneyLover XLSX as the sole import format

**Decision:** The app does not record transactions manually. All expense data comes from XLSX exports of the MoneyLover mobile app. The parser lives in `src/lib/parse-moneylover.ts`. Imports can come from a local file upload or from a Google Drive folder (`src/lib/actions/drive.ts`).

**Why:** MoneyLover is the user's existing habit for recording daily expenses. Building around its export format means no duplicate data entry — the phone app stays as the primary capture tool.

**Replace strategy:** Re-importing the same month runs `deleteMany` on the existing batch before creating a new one inside a single Prisma `$transaction`. This makes imports idempotent.

---

## ADR-006 — Derived balances (never stored)

**Decision:** Account balances, loan remaining amounts, and installment remaining debt are never stored. They are always computed at query time from the underlying ledger of entries, transfers, and payments.

**Why:** Storing computed values creates a second source of truth that must be kept in sync. The ledger approach (entries + transfers − loans + payments) is always correct regardless of when or how records are modified. The performance cost is acceptable for a single-user app with modest data volumes.

---

## ADR-007 — German amortization for installments

**Decision:** Installments use German (cuota decreciente) amortization: fixed capital per payment (P/n) plus decreasing interest on the outstanding balance. The `monthlyAmount` stored in the DB is always the capital portion only. The actual total due for payment k is computed via `computeInstallmentDue` in `src/lib/installment-utils.ts`.

**Why:** German amortization is the default used by Colombian retail credit and matches how the user thinks about their purchases. Storing only capital and recomputing interest at read-time avoids recalculation bugs if the interest rate were ever corrected.

---

## ADR-008 — Budget classification at the AppCategory level with item-level type

**Decision:** Each AppCategory can have multiple `BudgetItem` lines, each independently typed FIXED or VARIABLE. The category's effective `BudgetType` is FIXED if all items are fixed, VARIABLE if all are variable, or MIXED if both exist. Severity classification rules differ by type: FIXED categories flag deviations from exact budget; VARIABLE/MIXED categories use percentage thresholds (OK ≤100%, Issue 101–120%, Critical >120%).

**Why:** Real spending doesn't fit neatly into one type per category. A "Bills & Utilities" category might have a fixed internet subscription and a variable electricity estimate. The item-level granularity lets the budget reflect reality while still computing a single severity per category for dashboard display.

---

## ADR-009 — AI Advisor with live financial snapshot

**Decision:** The AI advisor is backed by Claude Haiku (`claude-haiku-4-5-20251001`) via the Anthropic SDK, called from a streaming API route at `src/app/api/chat/route.ts`. On every request, a plain-text financial snapshot is generated from live DB data (`getFinancialSnapshot`) and injected as the system prompt. Conversation history (last 20 messages) is persisted in the `ChatMessage` table and replayed on each call.

**Why:** Giving the model live, structured financial data avoids hallucinated numbers. Claude Haiku is used (not Sonnet/Opus) to keep per-message costs low for a personal app. Streaming via `ReadableStream` + text/plain gives responsive UX without a third-party streaming library.

---

## ADR-010 — Google Drive integration for imports

**Decision:** In addition to local file upload, the import form can list and fetch files from a designated Google Drive folder using a service account (`GOOGLE_SERVICE_ACCOUNT_JSON` env var). Drive auto-converts uploaded XLSX to Google Sheets format, so the download step detects the MIME type and uses the export endpoint for Sheets or `alt=media` for raw XLSX files.

**Why:** The user stores MoneyLover exports in Google Drive after syncing from their phone. The Drive integration removes the manual download → upload step.

---

## ADR-011 — Health Score as cross-module composite metric

**Decision:** A numeric Health Score (0–100) aggregates data from all three modules into four equally-weighted metrics of 25 points each: Savings Rate (expenses module), Variable Burn Rate (expenses), Installment Burden (installments), and Liquidity Ratio (loans). Displayed on the Overview page with a month-over-month delta.

**Why:** The Overview page needs a single headline that reflects the user's overall financial position across all modules. The four metrics were chosen because they represent the primary failure modes: not saving enough, overspending discretionary, over-committed in installments, and capital trapped in uncollected loans.

---

## ADR-012 — Cookie-based theme persistence (no next-themes SSR flash)

**Decision:** The active theme (`dark` or `light`) is stored in a plain cookie (`theme=dark`) set by the sidebar toggle button. The root layout reads the cookie server-side and adds the appropriate class to `<html>`. `next-themes` is listed as a dependency but is not used for this mechanism.

**Why:** Cookie-based persistence means the correct theme class is present on the server-rendered HTML, eliminating the flash-of-wrong-theme that client-side `localStorage` approaches produce. The sidebar footer button updates both the DOM class and the cookie synchronously.

---

## ADR-013 — prisma.config.ts must mirror directUrl from schema.prisma

**Decision:** `prisma.config.ts` (project root) must always include `directUrl: env("DIRECT_URL")` in its datasource block, mirroring the same field in `prisma/schema.prisma`.

**Why:** When `prisma.config.ts` is present, Prisma uses it as the authoritative datasource configuration and silently ignores the `datasource db` block in `schema.prisma`. This means a `directUrl` defined only in `schema.prisma` has no effect when `prisma.config.ts` exists. Without `directUrl`, all database connections — including `prisma migrate deploy` DDL statements — are routed through the pgbouncer pooler (port 6543). pgbouncer does not support DDL in transaction mode, so migrations hang indefinitely. Fix: always keep `directUrl` in both files. If `prisma.config.ts` is ever removed, the `schema.prisma` entry still applies.

---

## ADR-014 — Vaults are a standalone ledger (not liquidity)

**Decision:** The Vaults module maintains its own `Vault` / `VaultEntry` ledger. Vault balances are never added to `SavingsAccount` balances, never factored into the Liquidity Ratio KPI, and never represented as `AccountEntry` records. Vault balance = `sum(VaultEntry.amount)` — computed, never stored (ADR-006 applies).

**Why:** Vaults are earmarked goal pockets, not liquid capital. Including vault balances in the liquidity view would inflate
 available funds and understate loan exposure. Keeping the ledgers separate means the Loans module accurately reflects deployable liquidity and the Health Score's Liquidity Ratio remains meaningful. The trade-off is that "total savings" across all vehicles requires an explicit cross-module sum, but that is a future dashboard concern.

---

## ADR-016 — Plan layer beside Actuals

**Decision:** Finance Lab adopts a two-layer model: **Actuals** (imported transactions, computed balances, severity — the record of what happened) and **Plan** (expected non-monthly outflows and, in future phases, expected inflows). The app's reconciliation job is comparing the two: given what's coming, what must be set aside this month, and where will you actually land? Plan inputs are material (above a meaningful threshold relative to income) and non-monthly by design — small noisy spending stays absorbed by the variable budget. Setup effort scales to stakes.

**Why:** The existing monthly budget can only represent costs that are smooth and monthly. Every recurring pain (annual taxes, semiannual insurance, birthday gifts) shares one root cause: there is no model of the future that isn't monthly. The Plan layer fixes this without changing the import habit.

**Re-spread is the default for shortfalls:** `requiredThisMonth = remaining / periodsLeft` is always recomputed from the current balance and next due date. Falling behind one month silently raises the next month's requirement — no auto-debt, no auto-raid of savings. See `docs/financial-model.md` for the full north-star model.

---

## ADR-017 — Recurring expense registry feeds a RECURRING vault

**Decision:** `VaultGoalType` gains a third value `RECURRING`. A `RECURRING` vault's `requiredThisMonth` is `sum(monthlySetAside(item))` over its linked `RecurringExpense` records — not a deadline split. The vault holds the money; the registry (`RecurringExpense` + `RecurringExpensePayment`) is the calendar. On payment, `nextDueDate` advances by `cadenceMonths` via `rollCycle()` inside a `prisma.$transaction`. The withdrawal from the vault is an ordinary `VaultEntry` with a negative amount, reusing the existing vault ledger. Balances are never stored (ADR-006 applies).

**Why:** Keeping sinking-fund money as a vault reuses the entire vault ledger, banner, status classification, and agent surface. A separate account or balance column would create a second source of truth. The `RECURRING` vault shape is the minimal addition that unblocks the non-monthly planning use case without blurring the Loans/Vaults boundary (ADR-014).

---

## ADR-015 — Agent upgrade: tool use + propose-then-confirm (supersedes ADR-009)

**Decision:** The AI advisor (`src/app/api/chat/route.ts`) was rewritten from a static-snapshot streamer to a tool-use loop. Model upgraded to `claude-sonnet-4-6`. The system prompt is minimal (role, date, currency, current module context). On each turn the model calls read tools to fetch exactly the data the question needs, and proposal tools to surface action cards. Proposal tools never mutate — they emit a `{"type":"proposal"}` NDJSON event. Mutation only happens when the user clicks Approve on an action card, which calls the pre-validated server action directly from the client. Transport changed from `text/plain` streaming to NDJSON (`application/x-ndjson`), one JSON object per line.

**Why:** The old advisor could only reason over a pre-baked ~2000-token snapshot injected on every message. The tool-use approach lets the model fetch only what it needs (cheaper per-call) and reason over live, granular data (individual transactions, any historical month, vault obligations). The propose-then-confirm gate means a misbehaving or hallucinating model can propose a bad action but can never silently mutate data. The existing server actions (which carry all validation) remain the only write path. `docs/agent.md` is the canonical spec for tool definitions and domain rules.

---

## ADR-019 — Forecasting from trend history (Phase C)

**Decision:** `getForecast(month, year)` reads the last 6 import batches via `getTrends`, feeds per-category spend history into `predictCategoryLanding` (recency-weighted mean ± 1 std), and projects a month-end savings rate. One read tool (`get_forecast`) surfaces this to the agent. No schema change, no proposal tool.

**Why:** Landing lower than expected (pain #2) can be addressed purely from existing import history — no new import habit, no mid-month workflow. The forecast is historical: it does not read current-month actuals. Mid-month pacing (reading a partial import to compute spend-so-far) requires an in-progress flag on ImportBatch (ADR-005 extension) and is explicitly deferred to the backlog.

**Thin data:** When fewer than 3 months of history exist, `dataSufficiency = "thin"` and the UI/agent stays quiet — no fabricated numbers.

**Income source:** Phase B (getIncomePlan) not yet shipped; expectedIncome falls back to trailing income average from getTrends.

---

## ADR-021 — Vault funding: optional account source (amends ADR-014)

**Decision:** A `VaultEntry` may now carry an optional `sourceAccountId` (FK → `SavingsAccount`). Sourced entries reduce that account's computed `available` balance — the money moves out of the savings pool and into the vault. Sourced vault money is tracked in a new `inVaults` figure reported by `getLoansOverview()`. `inVaults` is displayed as a standalone "Earmarked in vaults" figure and is NEVER rolled into `totalSavings`. The formulas `totalSavings = available + inLoans` and `liquidityRatio = available / totalSavings` are unchanged; the Health Score (ADR-011) is untouched. `netWorth = totalSavings + inVaults` is the conserved quantity (shown as an informational line). Unsourced contributions remain notional earmarks and are unchanged from ADR-014. Existing entries get `sourceAccountId = null` (backward compatible, no backfill).

---

## ADR-022 — Multi-channel agent via neutral ProposalDescriptor + shared resolveProposal

**Decision:** The agent core (`run-agent-turn.ts`) is channel-agnostic. It emits `ProposalDescriptor` objects and returns `AgentTurnResult`; it knows nothing about React or Telegram. Channel-specific rendering lives in thin adapters (`action-card.tsx` for web, `render.ts` for Telegram). Both channels approve through a single server-side `resolveProposal()` in `execute-proposal.ts`, which looks up a persisted `PendingProposal` and runs the mapped server action. This replaces web's previous client-side execution of server actions from `action-card.tsx`. The Telegram webhook is locked to a single authorized `chat_id` (hard allowlist) and verified with a webhook secret token. Propose-then-confirm (ADR-015) is intact on every channel.

**Why:** A single write path is easier to audit and extend. The channel-agnostic core means adding WhatsApp or any other channel only requires a new renderer and webhook handler — no changes to the agent brain.

---

## ADR-023 — Agent write-scope expansion (installments, loans, debtors, payments)

**Decision:** The agent gains proposal tools for: creating installments (`propose_create_installment` with true-cost preview), marking cuotas paid (`propose_mark_installment_paid`), creating loans (`propose_create_loan`), recording repayments (`propose_record_loan_payment`), importing from Drive (`propose_import_from_drive`), and undoing the last conversational write (`propose_undo_last`). All map to existing validated server actions. New entities (debtor, credit card) may be created within the same proposal card; savings accounts may NOT be auto-created (ask user). Propose-then-confirm (ADR-015) is unchanged. Money-moving cards state: source account, any new entity being created, cuota math + total interest (installments), resulting balance change. `execute-proposal.ts` stores `createdId` back into `PendingProposal.params` after each create action so undo can reference it. A `PendingProposalStatus` value `"undone"` is added to mark reversed proposals.

**Why:** Conversational data entry reduces friction for recurring operations (buying on credit, lending money, marking a monthly cuota) without bypassing any validation. The true-cost preview surfaces the real cost of financed purchases — information the user currently computes manually. Centralizing all writes through `resolveProposal()` (ADR-022) means undo is implementable via a reverse-map without any new write paths. Telegram surfaces an ↩ Undo inline button after each approved reversible action.

---

## ADR-024 — Partial import batches (IN_PROGRESS / FINAL) — extends ADR-005

**Decision:** `ImportBatch` gains a `BatchStatus` enum (`IN_PROGRESS` | `FINAL`, default `FINAL`). Heuristic: if the parsed period's month equals the current calendar month, the import is flagged `IN_PROGRESS`; end-of-month re-imports flip it to `FINAL` (or the agent can override via `propose_import_from_drive`). `IN_PROGRESS` batches are excluded from historical baselines: `getTrends()`, forecast history (ADR-019), and `getHealthScore()`. They ARE used for current-month analysis (`getMonthlyAnalysis`) but the response includes `isInProgress: true` so the UI can badge "in progress". Re-importing the same month still replaces the batch (ADR-005 unchanged). When an `IN_PROGRESS` batch exists for the target month, `getForecast()` enters pacing mode: it blends actuals-so-far with the historical prediction (60/40 split) to compute a projected landing, and returns `pacingMode: true`, `spentSoFar`, `projectedVariableSpend`, `daysElapsed`, and `daysInMonth`.

**Why:** Mid-month imports are more useful than month-end imports for course-correction, but a partial month looks artificially under-budget and would corrupt multi-month trend analysis and forecast history if treated as final. The status flag resolves the conflict: partial months are visible in the current-month view while being invisible to the historical baseline.

---

## ADR-025 — System prompt is a single source in code (`prompt.ts`); `agent.md` is documentation

**Decision:** The full runtime system prompt lives in `src/lib/agent/prompt.ts`, exported as `buildSystemPrompt({ now, context })`. `run-agent-turn.ts` imports and calls it — no inline prompt string remains in the call site. Tool schemas (the `TOOLS` array) stay in `run-agent-turn.ts` by necessity. `docs/agent.md` is now a human-readable description of the agent's behavior, not the source of truth for the words the model sees.

**Why:** The prompt text previously existed both as an inline string in `run-agent-turn.ts` and as prose in `agent.md`, kept in sync by hand. They had already drifted (the doc still referenced `route.ts` after the Telegram refactor moved the prompt). A single code source eliminates the drift: to change the agent's behavior, you edit `prompt.ts`; to understand the intent, you read `agent.md`.

---

## ADR-026 — Proposal actions: identifier = tool name; single Action Registry

**Decision:** The proposal tool name (`propose_*`, verbatim, no transformation) is the canonical action identifier across: the tool schema, `PROPOSAL_TOOLS`, `PendingProposal.action`, the executor, and undo. `src/lib/agent/actions.ts` exports `PROPOSAL_ACTIONS` (the registry, keyed by exact tool name) and `REVERSIBLE_ACTIONS` (derived subset). `run-agent-turn.ts` derives `PROPOSAL_TOOLS` from `Object.keys(PROPOSAL_ACTIONS)` and stores `toolBlock.name` verbatim. `execute-proposal.ts` dispatches via `PROPOSAL_ACTIONS[proposal.action]` with no case mapping. Web and Telegram both approve through `resolveProposal()` — channel unification (ADR-022) is maintained.

**Why (root cause fixed):** Prior to this ADR, three naming conventions coexisted: the producer stripped `propose_` (stored `create_vault`), the executor switch used `propose_*` for vault/recurring cases but camelCase for Drive/installments/loans (`importFromDrive`, `createInstallment`, `createLoan`, `recordPayment`, `undoProposal`). Zero cases matched → every approval threw "No handler for action." The second bug: `fileName` was absent from the `propose_import_from_drive` tool schema, so the confirmation card showed the raw file ID and `ImportBatch.filename` was wrong. The registry eliminates the transform at the source, so the mismatch class is structurally impossible. `fileName` is now an optional schema field, with a fallback `listDriveFiles()` lookup when omitted.

---

## ADR-027 — Savings-account proposal tools + ask-XOR-propose rule

**Decision:** The agent gains two proposal tools mapping directly to existing `SavingsAccount` server actions: `propose_account_adjustment` (`createEntry({ type: "ADJUSTMENT" })` — a signed, no-repayment-expected debit/credit/correction on one account) and `propose_transfer` (`createTransfer()` — moves money between two of the user's accounts). Both resolve account name → id via `getLoansOverview()` and, like `propose_create_loan`, NEVER auto-create a `SavingsAccount` — an unresolved name returns a `blockingMessage` listing the real accounts. `createEntry`/`createTransfer` (`src/lib/actions/loans.ts`) now return the created row so `executeAccountAdjustment`/`executeTransfer` can store `createdId` for undo (`deleteEntry`/`deleteTransfer`), following the same store-then-delete pattern as `propose_create_loan`. `prompt.ts` gains explicit rules: (a) one turn is a question OR a proposal, never both — ask one concise question with no proposal call if any field is missing/ambiguous, propose only once everything is known; (b) a savings account is not a vault — balance changes and transfers use these two tools, never `propose_vault_*`; (c) a gift or direct expense out of an account is an account adjustment, not a loan — `propose_create_loan` is reserved for money expected back from a named debtor. Telegram (`src/app/api/telegram/route.ts`) and web (`src/app/api/chat/route.ts`) now always persist a combined assistant turn — `[text, proposalSummary].filter(Boolean).join("\n\n")` — instead of persisting only `if (result.text)`, so a turn that only emitted a proposal (no text) still threads into the shared `ChatMessage` history the next turn reads back.

**Why:** Before this fix there was no tool for a direct savings-account operation, so the model reached for the nearest wrong one — mislabeling an account as a vault, inventing a loan for a gift, or hallucinating an import — because no correct option existed. Persisting only `result.text` silently dropped proposal-only turns from history, so the model couldn't see what it had already asked or proposed and re-asked or drifted to a different tool across turns. Fixing the missing capability, the persistence gap, and the prompt ambiguity together (rather than any one in isolation) removes all three observed symptoms at their root cause.

---

## ADR-028 — External ingest channel (`/api/ingest`)

**Decision:** A third channel over `runAgentTurn()` — `POST /api/ingest` — lets an external authenticated client (an iPhone Shortcut forwarding a bank notification) send free text to the agent. Auth is a plain bearer-secret comparison (`Authorization: Bearer <token>` against `process.env.INGEST_SECRET`, mirroring the existing `TELEGRAM_WEBHOOK_SECRET` check precedent — no timing-safe comparison, consistent with the rest of the codebase). The endpoint validates `{ text }` is non-empty, returns `200 { ok: true }` immediately, and defers the actual work to `after()`. The agent turn's reply and any proposal cards are always routed to Telegram — there is no ingest-specific UI, so the approve loop closes where the user already is. The Telegram webhook's `handleTextMessage` and the new ingest route both now call a single shared helper, `runTurnAndDeliverToTelegram()` (`src/lib/agent/deliver-to-telegram.ts`), which owns history loading, `saveMessage`, the `runAgentTurn({ channel: "telegram" })` call, combined assistant-turn persistence (ADR-027), and delivery to `TELEGRAM_ALLOWED_CHAT_ID`. `ChatMessage.channel` widens from `"web" | "telegram"` to `"web" | "telegram" | "shortcut"` to tag the new channel; `runAgentTurn()`'s own `channel` param is unchanged (`"telegram"` always, since delivery is always Telegram regardless of entry point) and `PendingProposal.channel` is unaffected for the same reason.

**Why:** Extracting the shared helper means the Telegram webhook and the ingest endpoint literally cannot diverge in behavior — same history load, same persistence shape, same delivery path — rather than two call sites that started identical and drifted over time. Routing ingest replies to Telegram (instead of building a second UI) reuses the entire propose-then-confirm surface (ADR-015) for free. No transaction-proposal tool exists yet, so today the agent simply explains it can't add a transaction — that's expected, not an error; the endpoint's job is only to get external text into the same agent + approval loop everything else already uses.

---

## ADR-029 — Agent history window loads most-recent N (chronological); ingest echoes source text

**Decision:** `loadHistoryWithIncoming()` (`src/lib/agent/deliver-to-telegram.ts`) now fetches `ChatMessage` with `orderBy: { createdAt: "desc" }, take: 20`, then `.reverse()`s the result back to chronological order before appending the incoming message. The web route (`src/app/api/chat/route.ts`) is now consistent — it previously fetched the entire table (`orderBy: "asc"`, no `take`) and sliced the last 20 client-side; it now does the same `desc + take: 20 + reverse` fetch instead of loading the whole table. Additionally, `runTurnAndDeliverToTelegram()` now echoes the raw ingested text to Telegram (`📥 Procesando: <text>`) before running the agent turn, gated to `channel === "shortcut"` only — normal Telegram messages are already visible in the chat, so they are not double-echoed.

**Why (root cause fixed):** The prior query used `orderBy: { createdAt: "asc" }, take: 20` — `asc` + `take` returns the 20 **oldest** rows in the table, not the most recent. Once a conversation exceeded 20 messages, the agent was permanently reading ancient history plus the current message, blind to everything recent — including the turn it had just sent. This is why a short reply like "Variable expenses" (answering the agent's own prior question) was misread as a fresh, unrelated request: the question it was answering had already scrolled out of the ever-stale 20-oldest window. Fetching `desc + take: 20` then reversing gets the most recent 20 messages in chronological order, without loading the whole table. The ingest echo separately fixes a visibility gap: previously an ingested bank message produced no visible trace in Telegram before the agent's reply, so the user couldn't verify what the agent was actually extracting from.

---

## ADR-030 — Manual transactions + bot-primary/backfill dedup

**Decision:** `Transaction` gains a `source` enum (`MONEYLOVER | MANUAL`, default `MONEYLOVER`) and its `batchId`, `externalId`, and `moneyLoverCategoryId` become nullable — null for MANUAL rows, populated for MONEYLOVER rows exactly as before. A new direct `appCategoryId` (+ `appCategory` relation, with a back-relation `AppCategory.transactions`) is the category link for MANUAL rows. **Category resolution rule, applied everywhere a transaction's category is read:** `appCategoryId ?? moneyLoverCategory?.mapping?.appCategoryId`. `src/lib/actions/transactions.ts` exposes `createTransaction()` (creates a MANUAL row, `batchId/externalId/moneyLoverCategoryId: null`) and `deleteTransaction()` (undo). The read/aggregate queries (`getMonthlyAnalysis`, `getTrends`, `getCategoryTransactions`, the chat snapshot) switched from batch-scoped (`where: { batchId }`) to date-range-scoped (`where: { date: { gte, lt } }`, via the new `getFinancialPeriodBounds()` helper in `src/lib/financial-period-utils.ts`, which inverts `parse-moneylover.ts`'s `financialMonthYear` logic), so a MANUAL transaction with no batch is aggregated by which financial-month bucket its date falls into. `getAvailableMonths()` (replacing batch-only "available months") unions `ImportBatch` months with financial-period months derived from MANUAL transaction dates, so a month captured entirely by the bot still appears in the period selector. On import (`importBuffer` in `src/lib/actions/import.ts`), existing MANUAL transactions for the batch's period are pre-fetched once; a parsed MoneyLover row is skipped as a duplicate when a MANUAL transaction matches on the same calendar day + exact amount (deliberately conservative — day+amount only, not wallet/merchant, to avoid wrongly dropping a real second transaction). Import returns `{ imported, skippedAsDuplicate, count }`.

**Why:** The bot becomes the primary expense-capture path (live Telegram/ingest capture of bank notifications), with the weekly MoneyLover XLSX import demoted to a backfill for whatever the bot didn't catch live (cash, missed alerts) — without losing MoneyLover's existing category-mapping machinery for import rows, and without double-counting a transaction the bot already recorded. The date-range query switch (rather than keeping batch-scoped queries and giving MANUAL rows a synthetic/shared batch) keeps `ImportBatch` meaning exactly one thing — a MoneyLover import run — instead of overloading it as a generic "month bucket," which would have muddied `getImportBatches()`'s meaning and the batch-replace-on-reimport invariant (ADR-005). The conservative day+amount dedup key trades a small chance of a missed duplicate (a second real transaction with the exact same amount on the same day) for zero risk of wrongly discarding a distinct, legitimate transaction — the safer failure mode for financial data.

---

## ADR-031 — Editable proposal fields

**Decision:** `ProposalDescriptor` (and the underlying `PendingProposal`) gains an optional `editable: EditableField[]` — `{ field, label, selectedId, options: { id, label }[] }[]` — populated by a resolver at proposal-creation time (not only mutated later) and persisted onto `PendingProposal.editable` (a `Json?` column added in the same migration as ADR-030, unused until this pass). `propose_add_transaction` is the first (and so far only) tool to populate it: the category is deliberately excluded from the static `fields` array and shown only through `editable`, with a synthetic `{ id: "__other__", label: "Otra…" }` option always last. One shared mutation, `applyProposalEdit(proposalId, field, optionId)` (`src/lib/agent/apply-proposal-edit.ts`), updates `PendingProposal.params[field]` and `editable[fieldIndex].selectedId` together, rejects edits on a non-pending proposal or an unrecognized field/option, and returns a re-rendered `ProposalDescriptor` (title reused as-is, `fields` rebuilt via the existing generic `buildProposalFields(params)` formatter rather than a full domain re-resolve). Both channels call this one function: Telegram via new index-based `callback_data` formats — `${proposalId}:eopen:{fieldIdx}` (reveal options, read-only), `${proposalId}:e:{fieldIdx}:{optIdx}` (apply + re-render, does **not** approve), `${proposalId}:eback` (restore the default card) — resolved against the already-persisted `editable[fieldIdx].options` so no agent re-run is needed; and web via a new `POST /api/proposals/edit` route (`{ proposalId, field, optionId }`), mirroring `POST /api/proposals/resolve`'s shape, consumed by a following Frontend pass. Indices are used in `callback_data` (not raw ids) specifically to stay well under Telegram's 64-byte limit regardless of id length. Approve/Dismiss behavior is completely unchanged for every existing proposal tool — none of them populate `editable`, so this is strictly additive.

**Why:** Prior to this, any wrong guess on a proposal (e.g. the wrong category) required dismissing the whole card and re-prompting the agent — clunky for the single highest-volume proposal type (adding a transaction from a bank message), where the amount/date/wallet are almost always right but the category guess is the one field worth double-checking. Editing in place, without a full agent turn, keeps the fix cheap and keeps propose-then-confirm intact: an edit only ever mutates the *pending* proposal's draft params, never approves — Approve still commits explicitly, now with whatever value is currently selected. Storing the option list on `PendingProposal.editable` at creation time (rather than recomputing it at edit time) means the index→id lookup for Telegram's compact callback format never needs to re-run the agent or re-query "what were the options" — it's a pure DB read.

---

## ADR-032 — Counterparty rules: the dictionary + CRUD layer

**Decision:** A new `CounterpartyRule` model is the dictionary that will eventually let a bank-message transfer to a known account/merchant/sender auto-categorize and route to the right wallet, instead of the user picking a category every time (e.g. "transfer to account 617…" is a payment to *Pets*, not a self-transfer). Fields: `matchType` (`ACCOUNT | MERCHANT | SENDER | KEYWORD`), `matchValue` (normalized on write), `direction` (`EXPENSE | INCOME | ANY`, default `ANY`), `appCategoryId` (→ `AppCategory`, new back-relation `AppCategory.counterpartyRules`), `wallet` (a plain string label — no first-class Wallet model, matching `Transaction.wallet`'s existing shape), `autoRecord` (default true), `recurring` (default false) + `expectedAmount` (foundation for Phase 3's cadence validation, unused here), `notes`, and `matchCount`/`lastMatchedAt` (bookkeeping for a later matching pass). `normalizeMatchValue(matchType, raw)` lives in its own file, `src/lib/normalize-match-value.ts`, rather than inside `actions/` or `queries/`, specifically because it is shared by two layers that must never drift apart: the CRUD write path here, and a later ingestion rule-matching pass that will normalize an extracted counterparty value the identical way before looking up a rule. It strips to digits-only for `ACCOUNT`, and trims + uppercases for `MERCHANT`/`SENDER`/`KEYWORD`. `createCounterpartyRule`/`updateCounterpartyRule` always normalize before writing — a stored `matchValue` is never raw. This pass adds only the data model, `src/lib/actions/counterparty-rules.ts` (create/update/delete), `src/lib/queries/counterparty-rules.ts` (`getCounterpartyRules()` — one query serving both the future settings page and the new `get_counterparty_rules` agent read tool), and three agent proposal tools (`propose_create_counterparty_rule`, `propose_update_counterparty_rule`, `propose_delete_counterparty_rule`) registered in `PROPOSAL_ACTIONS`/`TOOLS`/`RESOLVER_REGISTRY` exactly like existing three-verb CRUD tools (e.g. the vault trio). Category-name resolution in these resolvers deliberately **blocks** on an unresolved name instead of silently falling back to a default (the pattern `resolveAddTransaction` uses) — a rule attached to the wrong category would silently misroute every future matching transaction, unlike a transaction proposal card where the category is directly editable. Only `propose_create_counterparty_rule` supports undo (delete-the-just-created-rule, the same `createdId`-store-then-delete pattern as `propose_create_loan`); update/delete do not, consistent with `propose_update_vault` also having no undo today — a generic before/after-snapshot undo for updates/deletes doesn't exist anywhere in this codebase yet and is out of scope here.

**Explicitly out of scope (a second, later pass):** ingestion rule-matching (`matchCounterpartyRule`), the auto-record-and-notify exception to propose-then-confirm, learn-from-corrections, and any `prompt.ts` wiring. That pass gets its own follow-up ADR. This ADR covers only the dictionary's schema and its CRUD surface.

**Why:** Building the data model and CRUD layer first — without touching ingestion, the prompt, or Telegram delivery — lets the schema and normalization contract get reviewed and tested in isolation, and gives the settings-page Frontend pass and the ingestion Backend pass a stable, already-migrated foundation to build against instead of landing all of Phase 2 as one large, harder-to-review change.

---

## ADR-033 — Counterparty rules: auto-record with reversible notification (the propose-then-confirm exception)

**Decision:** `propose_add_transaction`'s tool schema gains optional `counterpartyAccount`/`counterpartyMerchant`/`counterpartySender`/`direction` fields — the model extracts these from a bank message exactly as it already extracts amount/date/wallet/note, no new capability. `resolveAddTransaction` (`src/lib/agent/proposals/transactions.ts`) consults `matchCounterpartyRule()` (new, in `src/lib/queries/counterparty-rules.ts`) with whichever candidates were provided, tried in priority order ACCOUNT → MERCHANT → SENDER (a single bundle call, not one per matchType, so the priority order and the `direction` filter live in one place), normalized via ADR-032's `normalizeMatchValue`. On a match where `rule.autoRecord` is true AND the amount/date pass a simple confidence check (`isConfidentTransaction`: amount is finite, date parses — deliberately not a scoring system), the resolver short-circuits into `autoRecordFromRule()` (new file, `src/lib/agent/auto-record-transaction.ts`): it calls `createTransaction()` immediately using the **rule's** `appCategoryId`/`wallet` (never the message's guessed category or stated account — this is the whole point: "transfer to account 617…" is a payment to whatever the rule says, not a self-transfer), bumps the rule's `matchCount`/`lastMatchedAt` via a new `bumpCounterpartyRuleMatch()` (deliberately a separate explicit step from the lookup — a match that wasn't ultimately used, e.g. `autoRecord: false` or a low-confidence parse, must not count as a real match for Phase 3's future cadence validation), and persists a `PendingProposal` row **already `status: "approved"`**, with `params.createdId` set to the new transaction's id — the identical shape `undoAddTransaction` already expects. This is the key reuse insight: because `propose_add_transaction` already has `undo: deleteTransaction` registered and reversible/approved-status proposals already drive the existing `↩ Undo` button (`REVERSIBLE_ACTIONS` check in `sendUndoButtonIfReversible`, `undo:{proposalId}` → `handleUndoCallback` → `executeUndo`), creating this row pre-approved means the notification's `↩︎ Deshacer` button reuses that exact callback format with **zero new undo code**. The signal that a resolver already performed its own write is a new optional `ResolvedProposal.autoRecorded: { transactionId, proposalId, message }` (`proposals/shared.ts`); `processProposalToolBlock` (`run-agent-turn.ts`) checks it before the normal params/title/fields path and short-circuits — no proposal card, no second `PendingProposal` row, just the `message` returned as the tool_result so the agent turn completes normally. `AgentTurnResult` gains a matching `autoRecorded: AutoRecordedNotice[]` array; `deliver-to-telegram.ts` reads it after `runAgentTurn()` returns and sends a dedicated notification (`toTelegramAutoRecordMessage()` in `telegram/render.ts`) with `[✏️ Editar] [↩︎ Deshacer]` buttons — `✏️ Editar` reuses the existing `eopen:0` callback format verbatim (the auto-recorded `PendingProposal.editable` is populated with the same category-shortlist shape a normal card carries, specifically so this works with no new callback format).

**Editing an already-auto-recorded transaction:** `applyProposalEdit` (`src/lib/agent/apply-proposal-edit.ts`) is extended, not forked — its guard now also accepts a proposal with `status: "approved"` when the action is in `REVERSIBLE_ACTIONS` and its params carry a `createdId` (exactly the auto-record case; a normal approved-and-non-reversible proposal, or one missing `createdId`, is still rejected). In that branch, after the usual params/editable mutation, it additionally calls a new `updateTransactionCategory()` (`src/lib/actions/transactions.ts`) to patch the **already-created** live `Transaction` row — unlike a pending proposal, where an edit only ever touches the draft, here the write already happened. Kept as one function (rather than a parallel edit path) so the Telegram `✏️`/`eopen`/`e:`/`eback` handlers in `route.ts` need zero new branching — they already just call `applyProposalEdit` by proposalId.

**Learning from corrections:** kept deliberately lightweight per the handoff's "genuinely optional/best-effort" framing — `resolveAddTransaction` stores a `hadCounterpartyMatch: boolean` marker in `params` (not rendered on the card) whenever a counterparty was extracted; `resolveProposal` (`execute-proposal.ts`) checks it after a normal approve and, when `false` (a counterparty was present but matched no rule at all — not merely "matched but wasn't auto-recorded"), returns a `learnRuleNudge` string. The Telegram route sends it as a plain follow-up chat message rather than a second interactive pre-filled card: the user can just tell the agent "sí, recuérdalo" in the next turn, and the model already has `propose_create_counterparty_rule` and `get_categories` available to build that rule conversationally. This is a deliberate simplification of the handoff's literal "emit a pre-filled propose_create_counterparty_rule card automatically" — flagged as a follow-up if Daniel wants the fully automatic pre-filled card instead of a suggested-reply nudge.

**Why this is a justified, narrow exception to propose-then-confirm:** mirrors ADR-027's framing for the account-tools exception — the rule being acted on is the *user's own* prior mapping (not a new inference), the action is fully reversible with one tap, and the user is notified immediately with the specifics (amount, category, wallet, which rule fired). Unlike a blind auto-apply, nothing happens the user didn't already configure, and undo/edit cost nothing extra to build because it rides the same `PendingProposal` + `REVERSIBLE_ACTIONS` infrastructure every other reversible proposal already uses — an approved-status row doesn't care how it got approved.

**Prompt updates (`prompt.ts`):** added the rule that a transfer to a named account is a payment, not a self-transfer between the user's own `SavingsAccount`s, and that counterparty fields should be extracted and passed to `propose_add_transaction` — the model does **not** need to call `get_counterparty_rules` itself before proposing a transaction (rule matching is transparent/automatic inside the resolver); that read tool remains for managing rules and answering "what rules do I have."

---

## ADR-034 — Batch card-statement ingestion from a screenshot (image input + multi-item proposal)

**Context:** Daniel pays most things with a credit card (for the card benefits) and sets aside the corresponding cash in a Bancolombia "pocket" to pay the card later. Every few days he screenshots the card app; today a Shortcut manually replays each row into MoneyLover. This ADR covers the whole feature end-to-end — both the image-ingestion plumbing (delivered first, deliberately undocumented until now — see `.scratch/card-screenshot-image-ingestion.md`) and the batch-proposal/rendering/approve/undo pass that gives it a user-visible capability. **No schema change anywhere in this feature** — `PendingProposal.params` and `.editable` were already `Json` columns; the batch shape nests inside `params.batch`.

**Image input (Telegram only):** the webhook (`src/app/api/telegram/route.ts`) gains a `message.photo` dispatch branch alongside text and `callback_query`. It resolves the **largest** `PhotoSize` (Telegram always orders smallest→largest), fetches the file via `getFile(file_id)` → `file_path` → `downloadFile()` (a second, separate file-host URL — new helpers in `src/lib/telegram/api.ts`), and hands the base64 bytes to `runImageTurnAndDeliverToTelegram()` (`src/lib/agent/deliver-to-telegram.ts`). `runAgentTurn()`'s `messages` param is widened from a hard-coded `string` content to the Anthropic SDK's own `MessageParam["content"]` union (`string | ContentBlockParam[]`) — purely additive, every existing string-only call site (web, the old Telegram text path, `/api/ingest`) keeps compiling unchanged. Only the **live incoming message** ever carries an image content block; every history row loaded from `ChatMessage` stays a plain string, and the image itself is never persisted — a fixed placeholder (`"📸 [foto de tarjeta recibida]"`) is saved instead, so `ChatMessage.content` never needs to become anything but a plain `String` column. A `"📸 Leyendo el pantallazo…"` echo fires before the turn runs, mirroring the shortcut-ingest echo (ADR-029).

**The batch proposal tool:** `propose_add_transactions_batch({ items: [{vendor, amount, date?, scratched?}], cardLabel? })` — registered in `TOOLS` (`tools.ts`), `PROPOSAL_ACTIONS` (`actions.ts`), and `RESOLVER_REGISTRY` (`proposals/index.ts`) exactly like every other three-place proposal tool registration. `amount` is always a positive magnitude in the tool schema — card purchases are always expenses, so both the resolver's display and the executor's write negate it; the model never sends a signed amount here (unlike `propose_add_transaction`). `scratched` is the model's own best-effort vision judgment of a crossed-out row; the resolver does zero server-side image analysis, it only maps `included = !scratched`.

**Resolution (`src/lib/agent/proposals/transactions-batch.ts`):** for each item, a `CounterpartyRule` lookup by vendor (`matchCounterpartyRule({ merchant: vendor, direction: "EXPENSE" })` — card purchases are never income) supplies `appCategoryId` when it matches; otherwise the exact same no-name fallback guess `resolveAddTransaction`'s card already uses on an unresolved/omitted category (`resolveCategoryGuess`/`buildCategoryShortlist`, now exported from `proposals/transactions.ts` for this reuse) — there is no per-item category-name guess from the vision model, so "best guess" here is deliberately the same heuristic, not a new one. **Only the rule's `appCategoryId` is borrowed, never its `wallet`** — every included row's wallet is the batch-level `cardLabel` instead, a deliberate divergence from ADR-033's single-transaction auto-record flow (which uses the rule's wallet). This is the whole point of a *batch*: all these purchases came from one card, so the card is the one wallet value that applies uniformly. `cardLabel` defaults to the model's guess (or a generic label) and its editable shortlist reuses the existing Installments-module `CreditCard.name` list via `getCardSummaries()` when any cards exist, degrading to just the default label + a synthetic `"Otra…"` when none do (no new Wallet/Card entity — mirrors the category shortlist's degrade pattern). The whole `BatchDescriptor` (`cardLabel`, `items[]`, `categoryOptions`, `cardLabelOptions`) is nested under `params.batch` — every field a Telegram/web callback needs to answer from a plain `PendingProposal` read, no agent re-run, the same design principle ADR-031's `editable` established. `editable` itself was NOT repurposed for this: its single-field/single-`selectedId` shape doesn't fit "many items, each with its own category id."

**No auto-record for batches — a deliberate difference from ADR-033.** A matched counterparty rule only supplies a category default here; it never triggers the ADR-033 auto-record short-circuit. Every batch, matched-by-rule or not, still goes through the review card. The reasons: (1) a batch is inherently multi-item and the user hasn't seen ANY of the rows yet (unlike a single bank notification, which is self-contained), so silently writing N unreviewed transactions is a materially bigger blind commit than one; (2) scratch-out detection is best-effort vision, not a guarantee — the review step is exactly where a wrong pre-exclusion or wrong inclusion gets caught before anything is written; (3) the "move to pocket" total is the whole point of the feature and needs the user's eyes on the final included set before it's meaningful.

**Rendering (`src/lib/telegram/render.ts`):** `toTelegramBatchMessage()` — a numbered list (`✓`/`✕ (tachado)` marker + `⚠︎` when `scratchDetected`), a footer (`Incluidas: N · Total: $X`), and a keyboard of `[{idx} ✓/✕] [{idx} ✏️]` button pairs per item (capped at 30 rows — Telegram allows ~100 buttons total and 2/item is comfortable rows to that point; beyond it, every item still renders in the text list, just without a button pair — a documented limitation, not a pagination system, per the handoff's explicit framing of long statements as a noted edge case, not a hard requirement), plus a `[💳 Tarjeta]` row and the reused `[✅ Aprobar N] [❌ Descartar]` row. `toTelegramBatchCategoryMessage()` / `toTelegramBatchCardLabelMessage()` are the option-picker views (one option per row, `✓` marks the current selection, back button), directly modeled on `toTelegramEditOptionsMessage()`'s shape rather than inventing a third near-identical renderer.

**Callback formats** (indices only, same 64-byte-budget discipline as ADR-031): `bt:{idx}` toggles inclusion, `be:{idx}` opens the category picker, `bs:{idx}:{optIdx}` applies a category, `bo` opens the card-label picker, `bc:{optIdx}` applies a card label, `bback` restores the default card view. All dispatched via a new `tryHandleBatchCallback()` in `src/app/api/telegram/route.ts`, mirroring `tryHandleEditCallback()`'s shape exactly, wired in alongside it in `handleCallbackQuery()`. Approve/Dismiss need **no new code** — the existing generic `${proposalId}:approve|dismiss` fallback already works, since `tryHandleBatchCallback` short-circuits (returns `true`) before that fallback runs, same pattern as the edit dispatcher.

**Shared mutation layer (`src/lib/agent/apply-batch-edit.ts`, new):** `toggleBatchItem`, `setBatchItemCategory`, `setBatchCardLabel` — each `(proposalId, ...)`, reading/writing `PendingProposal.params.batch`, returning a re-rendered `ProposalDescriptor` via `transactions-batch.ts`'s exported `buildBatchDisplay()` (so proposal-creation-time and every post-mutation re-render compute title/fields identically, one function, not two copies). Used **identically** by both the Telegram callbacks above and a new `POST /api/proposals/batch-edit` route (`{ proposalId, op: "toggle"|"setCategory"|"setCardLabel", itemIdx?, optionIdx? }`) — the web counterpart the following Frontend pass's `ActionCard` batch table consumes, mirroring `POST /api/proposals/edit`'s shape. This is the same "one shared function, two channel-specific callers" pattern ADR-031 established for `applyProposalEdit`.

**Threading `batch` onto the descriptor:** `ResolvedProposal` doesn't gain a new top-level `batch` field — the resolver nests it under `params.batch`, and `processProposalToolBlock` (`run-agent-turn.ts`) reads `finalParams.batch` and threads it onto both the persisted `PendingProposal.params` (already there, since `finalParams` IS `params`) and the returned `ProposalDescriptor.batch`, alongside the existing `editable`/`autoRecorded` checks — additive, no rewrite of that function's shape.

**Approve → create + total (`actions.ts`):** `executeAddTransactionsBatch` reads `params.batch` **as it stands at approve time** — after whatever toggles/edits the user made via the callbacks above, not the original tool-call input — filters to `included` items, and calls `createTransaction({ amount: -Math.abs(item.amount), date: item.date ?? today, appCategoryId: item.appCategoryId, wallet: batch.cardLabel, note: item.vendor })` once per included row. Returns `{ createdIds, count, total, message }`, where `message` is the required reply copy: `"✅ Agregadas {count} · Total {formatCOP(total)} · mueve {formatCOP(total)} a tu pocket de Bancolombia."` No pocket entity is created or modeled anywhere — the message is purely informational text telling Daniel how much to move himself.

**The generic `message` escape hatch (`execute-proposal.ts`):** prior to this ADR, `resolveProposal()` always replied `"Approved"` on success, with one existing bolt-on special case (`learnRuleNudge`, ADR-033, a separate field). Rather than adding a second `if (action === "propose_add_transactions_batch")` branch (which would make a THIRD special case and start to smell), `resolveProposal`'s approve-dispatch step (factored into a new `executeApprovedAction()` helper, incidentally also fixing a cognitive-complexity budget trip) now treats `message` in an action's `execute()`-returned extra-fields object as a generic override for the default `"Approved"` string. `message` is stripped before the rest of the extra fields are persisted onto `PendingProposal.params` — it's reply text, not proposal state; undo/display never need it back. `propose_add_transaction`'s existing `learnRuleNudge` behavior is completely unaffected — it's a different, additional field, checked independently.

**Surfacing that message on Telegram (`handleResolveCallback`, `route.ts`):** `resolveProposal()`'s returned `message` was, until a reconcile pass over this same ADR, only ever passed to `answerCallbackQuery` — Telegram's ephemeral toast, auto-dismissed after a few seconds. For the batch's rich summary (count/total/pocket reminder), that meant the one piece of information Daniel actually needs to act on (how much to move to the Bancolombia pocket) was never persistent or referable. `handleResolveCallback` now also uses `result.message` as the persistent edited-message text whenever it isn't the generic `"Approved"` default (via a small `approvedMessageText()` helper), falling back to `"✅ Approved"` for every other action — zero change to any non-batch proposal's Telegram UX.

**Undo:** `undoAddTransactionsBatch` loops `deleteTransaction()` over every id in `createdIds`. Because `propose_add_transactions_batch` is registered with an `undo` function, `REVERSIBLE_ACTIONS` picks it up automatically (ADR-026) — `propose_undo_last` reverses the whole batch with no extra registration.

**Prompt updates (`prompt.ts`):** a new paragraph, styled after the existing bank-message paragraph, instructing that a credit-card statement/screenshot (as opposed to a single bank notification) means extract every row, mark best-effort scratched rows, emit exactly one `propose_add_transactions_batch` call, no per-row clarifying questions, and that card purchases are always expenses (positive magnitude for this tool, not signed).

**Docs:** `docs/agent.md` gets a `propose_add_transactions_batch` row in §4.2 and a new §5h explaining the "no auto-record for batches," "wallet = cardLabel not rule's wallet," and "approve reads current, not original, state" rules (the three places this feature diverges from precedent someone reading only §5f/§5g might assume). `docs/modules.md` documents the new resolver file, `apply-batch-edit.ts`, the `actions.ts`/`tools.ts`/`render.ts`/`run-agent-turn.ts`/`execute-proposal.ts` additions, and the new `batch-edit` route. This ADR folds in Part 1's image-ingestion pieces (deliberately left undocumented in `decisions.md` when Part 1 alone shipped, per its own follow-up note) since neither half was a complete, user-visible capability on its own.

**Why one ADR for both parts:** Part 1 (image ingestion) had no user-visible capability by itself — nothing consumed the image beyond a plain vision reply. Splitting the record across two ADRs would describe a capability that only exists once both halves are read together; one ADR describing the complete, working feature is more honest about what actually shipped and when.

---

## ADR-035 — Transaction ledger view + edit/delete; editing a MoneyLover row detaches it to MANUAL

**Decision:** A new query, `getTransactionList(month, year, groupBy, filters)` (`src/lib/queries/transactions.ts`), gives the expenses module a granular, MoneyLover-style ledger — the day-by-day/category/wallet view alongside the existing budget-vs-actual analysis (`getMonthlyAnalysis`). It selects transactions the same date-range-scoped way as `getMonthlyAnalysis` (`getFinancialPeriodBounds`, ADR-030) and resolves each transaction's category with the same rule (`appCategoryId ?? moneyLoverCategory?.mapping?.appCategoryId`), then groups the resolved rows by `day` (newest-first, one bucket per calendar day), `category`, or `wallet` (both sorted by `|subtotal|` descending), applying `category`/`wallet`/`type`/`search` filters before grouping. Two figures are deliberately **not** filter-aware: `monthTotalExpense`/`monthTotalIncome` are always computed from the full month's transactions, so the ledger's header band stays numerically consistent with `getMonthlyAnalysis` for the same month no matter what the user has currently filtered the list down to — this is what lets the two views agree by construction rather than by coincidence. `categorySummary`, by contrast, **is** affected by active filters — it reports on what the user is currently looking at, not the whole month, and this asymmetry is intentional: one figure is a stable KPI, the other is a live view of the current selection. `search` matches only against `note` — the one vendor-ish free-text field both MANUAL and MoneyLover rows carry; `moneyLoverCategory.name` is taxonomy, already reachable through the `category` filter, so folding it into `search` too would just be a second way to do the same narrowing. Day-group labels use a hand-assembled Spanish short format ("Mié 8 jul") rather than `Intl`'s default es-CO output, which inserts `", "` / `" de "` separators the design didn't ask for.

**The action:** `updateTransaction(id, { amount?, date?, appCategoryId?, wallet?, note? })` (`src/lib/actions/transactions.ts`) is a general partial-update, extending the file that already has `createTransaction`/`deleteTransaction`/`updateTransactionCategory` (ADR-030/033). **Detach-on-edit rule:** if the row being edited currently has `source === MONEYLOVER`, the same `db.transaction.update` call also sets `source: MANUAL`, `batchId: null`, `moneyLoverCategoryId: null` — the user's edit becomes authoritative, and a future re-import of that month can't silently overwrite it, because the existing import dedup (ADR-030: MoneyLover rows are skipped as duplicates when a MANUAL row matches on the same day + exact amount) now correctly treats this row as already-captured. If the caller's edit doesn't include a new `appCategoryId`, a detaching row keeps its current effective category (resolved via the same ADR-030 rule, read directly off the row) instead of silently going uncategorized. In the edge case where neither a direct category nor a mapping resolves (an uncategorized MoneyLover row being edited), the detached MANUAL row is left with `appCategoryId: null` — the schema already permits this (`appCategoryId` is nullable), so no error is raised for what's a pre-existing data-quality gap, not a new one this feature introduces. `deleteTransaction` (already existing) is wired to the Ledger's row-delete control unchanged — its `revalidateAll()` scope (`/expenses`, `/overview`, `/trends`) already covers what the Ledger needs.

**Why:** The existing `getMonthlyAnalysis` view answers "how am I doing against budget this month" but has no row-level surface — seeing/fixing an individual transaction meant going back into MoneyLover itself. A ledger view closes that gap without inventing a second data model or a second category-resolution rule; it's the same transactions, the same date-range selection, the same resolution rule, just grouped and filtered differently. The detach-on-edit rule is the ADR-031/033 "editable, reversible, authoritative" philosophy applied to a plain in-app edit: rather than inventing a second dedup mechanism for "this row was manually corrected, don't re-import over it," it reuses the exact mechanism ADR-030 already built for bot-captured MANUAL rows — a MoneyLover row a human corrected is, from that point on, indistinguishable from one the bot captured live, which is exactly the desired behavior.
