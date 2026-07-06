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

