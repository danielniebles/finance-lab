# Modules

> Last updated: 2026-07-07

## Project structure
```
src/
  app/
    layout.tsx              — Root layout: fonts, theme cookie → html class
    page.tsx                — Redirects to /overview
    (app)/
      layout.tsx            — App shell: SidebarProvider + ChatProvider + FloatingChat
      overview/page.tsx     — Home dashboard (Health Score, KPI cards, module snapshots)
      expenses/page.tsx     — Monthly expense analysis + XLSX import
      trends/page.tsx       — Multi-month income/expense/category charts
      installments/page.tsx — Installment CRUD + monthly due summary
      loans/page.tsx        — Savings accounts + debtor/loan management
      vaults/page.tsx       — Goal-based savings pockets (CRUD + obligations)
      chat/page.tsx         — Full-screen AI advisor chat
      settings/
        categories/page.tsx — AppCategory + BudgetItem CRUD
        mappings/page.tsx   — MoneyLoverCategory → AppCategory mapping
        rules/page.tsx      — CounterpartyRule CRUD (ADR-032) — FOLLOW-UP, not yet built by this pass
    api/
      chat/route.ts         — Thin NDJSON streaming wrapper over runAgentTurn; emits {type:"proposal",proposalId,...} events
      proposals/
        resolve/route.ts    — POST handler: { proposalId, choiceId } → resolveProposal() → { ok, message }
        edit/route.ts       — POST handler (ADR-031): { proposalId, field, optionId } → applyProposalEdit() → { ok, descriptor?, message? }
        batch-edit/route.ts — POST handler (ADR-034): { proposalId, op: "toggle"|"setCategory"|"setCardLabel", itemIdx?, optionIdx? } → toggleBatchItem()/setBatchItemCategory()/setBatchCardLabel() → { ok, descriptor?, message? }. Web counterpart to Telegram's bt:/bs:/bc: callbacks, consumed by `components/chat/batch-proposal-table.tsx`'s interactive table.
      telegram/
        route.ts            — Telegram webhook: verifies secret token + allowlist; dispatches message and callback_query updates, incl. eopen:/e:/eback editable-field callbacks (ADR-031). `message.photo` (a card-screenshot photo) is a third dispatch branch alongside text and callback_query — resolves the largest `PhotoSize`, downloads it via `getFile`/`downloadFile`, and hands the bytes to `runImageTurnAndDeliverToTelegram` (image ingestion, Part 1 of the card-screenshot batch feature; see `.scratch/card-screenshot-image-ingestion.md`). Since ADR-034, also dispatches the batch callback formats `bt:{idx}`/`be:{idx}`/`bs:{idx}:{optIdx}`/`bo`/`bc:{optIdx}`/`bback` via `tryHandleBatchCallback()` (mirrors `tryHandleEditCallback()`'s dispatch shape) — mutates `PendingProposal.params.batch` via the shared `apply-batch-edit.ts` functions and re-renders through `telegram/render.ts`'s batch views; approve/dismiss reuse the existing generic `${proposalId}:approve|dismiss` fallback unmodified.
      ingest/
        route.ts            — External ingest webhook (ADR-028): bearer-auth POST { text }, 200 { ok: true } immediately, then runs the shared delivery helper in after()
  components/
    app-sidebar.tsx         — Sidebar nav + theme toggle
    overview/               — OverviewDashboard (BudgetBarsPanel, TopUnplannedPanel), ExpenseDonut, ForecastPanel
    expenses/               — ImportForm, AnalysisDashboard, CategoryBreakdownTable, PeriodSelector, ViewTabs, TransactionLedgerPage, LedgerControls, TransactionGroupList, TransactionRow, LedgerEmptyState
    trends/                 — TrendsDashboard (Recharts)
    installments/           — InstallmentsDashboard (client), InstallmentForm, PayButton, MonthNav, AllInstallmentsTable, InstallmentActions, CreditCardTile, CreditCardManager
    loans/                  — LoansDashboard, AccountCard, DebtorForm, LoanForm, PaymentForm, EntryForm, AccountForm, TransferForm, LoansClient, LoanRowActions
    vaults/                 — VaultsDashboard (client), VaultTile, VaultForm, EntryForm, VaultLedger, VaultDueBanner, RecurringList, RecurringExpenseForm
    settings/               — CategoryList, MappingList
    chat/                   — FloatingChat, ChatProvider, ChatMessages, ChatInput, ActionCard (renders `editable` fields, ADR-031, as a `<select>`; branches to BatchProposalTable for `proposal.batch`, ADR-034), BatchProposalTable (interactive batch table — checkboxes + category selects + card-label select + live total)
    ui/                     — shadcn/ui base-nova primitives
  lib/
    db.ts                   — Prisma client singleton
    format.ts               — formatCOP(), formatShort(), MONTH_NAMES
    utils.ts                — cn() (clsx + tailwind-merge)
    installment-utils.ts    — computeMonthlyAmount(), computeInstallmentDue(), isDueInMonth(), computeMonthSummary(), rate converters
    vault-utils.ts          — computeVaultMetrics(), classifyVault(), monthsLeft() — pure math, client-safe
    forecast-utils.ts       — pure math for the forecasting module; predictCategoryLanding (recency-weighted mean, MIN_MONTHS guard), projectSavingsRate. Mirrors vault-utils.ts pattern.
    forecast-utils.test.ts  — Vitest unit tests for forecast-utils (12 tests: prediction, null/thin-data cases, projectSavingsRate edge cases). Run with `npm test`.
    parse-moneylover.ts     — XLSX → Transaction[] parser
    financial-period-utils.ts — getFinancialPeriodBounds(month, year, startDay): inverts parse-moneylover.ts's financialMonthYear — given a calendar (month, year), returns the [start, end) date range for that financial-month bucket. Lets queries select transactions by date range instead of by ImportBatch, so MANUAL (bot-captured) rows with no batch are included (ADR-030).
    normalize-match-value.ts — normalizeMatchValue(matchType, raw) (ADR-032): pure normalization for CounterpartyRule.matchValue — digits-only for ACCOUNT, trimmed+uppercased for MERCHANT/SENDER/KEYWORD. Standalone (not inside actions/ or queries/) because it's shared by the CRUD write path and by matchCounterpartyRule's lookup path (ADR-033) — both must normalize identically.
    queries/
      expenses.ts           — getMonthlyAnalysis() (date-range scoped via getFinancialPeriodBounds, category resolved per ADR-030's rule), getImportBatches(), getAvailableMonths() (unions ImportBatch months with MANUAL-transaction financial-period months — replaces the old batch-only "available months"), getCategories() (CategoryOption[] — used by get_categories and propose_add_transaction's shortlist), getUnmappedCategories()
      installments.ts       — getAllInstallments(), getMonthSummary()
      loans.ts              — getLoansOverview() — now returns inVaults + netWorth; account balance formula subtracts vaultFundedNet
      trends.ts             — getTrends() — date-range scoped like getMonthlyAnalysis; a manual-only month always counts, a month with an IN_PROGRESS batch stays excluded even with manual transactions present (ADR-030)
      health-score.ts       — getHealthScore()
      chat.ts               — getFinancialSnapshot() — date-range scoped + null-safe category resolution, so manual transactions are included in the agent's snapshot (ADR-030)
      vaults.ts             — getVaults() (branches on goalType: RECURRING uses summed set-asides), getVaultObligations(); VaultEntryRow now includes sourceAccountId + sourceAccountName
      recurring.ts          — getRecurringExpenses(month, year): items with set-aside + status
      accounts.ts           — getSavingsAccounts(): lightweight AccountOption[] (id, name, balance) for pickers
      counterparty-rules.ts — getCounterpartyRules(): CounterpartyRuleRow[] (ADR-032) — all rules, category name resolved, ordered by matchType/matchValue; serves both the get_counterparty_rules read tool and the future settings/rules page. Also matchCounterpartyRule(candidates) (ADR-033) — bundle lookup over { account?, merchant?, sender?, direction }, tried ACCOUNT → MERCHANT → SENDER, normalized via normalize-match-value.ts, filtered by direction (ANY matches either); pure read, does NOT bump usage. bumpCounterpartyRuleMatch(ruleId) — separate explicit step, called only by the auto-record path once a match is actually used.
      transactions.ts — (new, ADR-035) getTransactionList(month, year, groupBy, filters): the expenses module's granular ledger view — date-range scoped and category-resolved identically to getMonthlyAnalysis, grouped by day (newest-first)/category/wallet (both sorted by |subtotal| desc) with category/wallet/type/search filters applied before grouping. monthTotalExpense/monthTotalIncome are always whole-month (filter-independent, so the ledger's totals agree with getMonthlyAnalysis regardless of what's filtered); categorySummary IS filter-aware (reports on the current selection). search matches only note. Day-group labels are hand-built ("Mié 8 jul") rather than Intl's default es-CO format.
    agent/
      types.ts              — ProposalChoice, ProposalDescriptor (now with optional editable: EditableField[], ADR-031; and optional batch: BatchDescriptor, ADR-034), EditableField, EditableOption, BatchItem, BatchDescriptor (ADR-034 — { cardLabel, items: BatchItem[], categoryOptions, cardLabelOptions }, nested under PendingProposal.params.batch, no schema change), AgentTurnResult (now with autoRecorded: AutoRecordedNotice[], ADR-033), AutoRecordedNotice (channel-agnostic types)
      prompt.ts             — System-prompt builder: single source of truth for the text sent to the model. ADR-033 adds: "transfer to account X" is a payment, not a self-transfer; extract counterparty fields for propose_add_transaction; rule matching is automatic (no get_counterparty_rules call needed before proposing). ADR-034 adds: a credit-card statement screenshot → extract every row (vendor, amount, date), mark scratched/crossed-out rows best-effort, emit exactly one propose_add_transactions_batch call, no per-row questions, card purchases are always expenses.
      actions.ts            — PROPOSAL_ACTIONS registry (keyed by exact propose_* tool name) + REVERSIBLE_ACTIONS; consumed by run-agent-turn.ts and execute-proposal.ts; single source of truth for proposal dispatch (ADR-026). Includes propose_add_transaction → createTransaction/deleteTransaction (ADR-030) and the propose_*_counterparty_rule trio → counterparty-rules.ts actions (ADR-032; only propose_create_counterparty_rule has undo). ADR-034 adds propose_add_transactions_batch → executeAddTransactionsBatch/undoAddTransactionsBatch: creates one Transaction per INCLUDED item (read from params.batch AS MUTATED by the toggle/edit callbacks, not the original tool input), wallet = batch.cardLabel for every row, amount always negated; returns { createdIds, count, total, message } — `message` is the "✅ Agregadas N · Total X · mueve X a tu pocket" reply text, picked up by execute-proposal.ts's generic message escape hatch; undo loops deleteTransaction() over every createdId.
      tools.ts              — TOOLS: Anthropic.Tool[] JSON schema array (read + proposal tool definitions the model sees). Includes get_categories and propose_add_transaction (ADR-030/031, extended with counterpartyAccount/Merchant/Sender/direction — ADR-033), get_counterparty_rules and propose_create/update/delete_counterparty_rule (ADR-032), propose_add_transactions_batch (ADR-034 — items: {vendor, amount, date?, scratched?}[], cardLabel?).
      read-tools.ts         — READ_TOOLS set + runReadTool(): name→handler registry over the fetch*/query functions for every read-only tool. Includes get_categories → getCategories() and get_counterparty_rules → getCounterpartyRules() (ADR-032).
      formatting.ts         — formatParamKey/formatParamValue, TITLE_BUILDERS, buildProposalTitle(), buildProposalFields(): proposal display formatting. buildProposalFields' skipKeys excludes appCategoryId (ADR-031) and, since ADR-033, the internal auto-record bookkeeping fields (hadCounterpartyMatch, ruleMatchType, ruleMatchValue, counterpartyAccount/Merchant/Sender) — none of these are user-facing card text.
      proposals/            — complex proposal resolvers, split by domain: shared.ts (ResolvedProposal type + buildResolvedProposal/blockingProposal helpers — buildResolvedProposal now takes an optional editable: EditableField[] 4th arg (ADR-031); ResolvedProposal also gains an optional autoRecorded: { transactionId, proposalId, message } (ADR-033) signaling the resolver already performed its own write), drive.ts, installments.ts, loans.ts, accounts.ts, transactions.ts (resolveAddTransaction — category name resolution + editable shortlist builder (ADR-030/031); now also consults matchCounterpartyRule and short-circuits into the auto-record path on a confident, autoRecord-eligible match — ADR-033; resolveCategoryGuess/buildCategoryShortlist are now exported for reuse by transactions-batch.ts), transactions-batch.ts (new, ADR-034 — resolveAddTransactionsBatch: resolves a whole list of vision-extracted `{vendor, amount, date?, scratched?}` rows into `BatchDescriptor.items`, per-item category from a CounterpartyRule match by vendor (direction always EXPENSE) or the same no-name fallback guess transactions.ts uses; builds the cardLabel shortlist from existing CreditCard names via getCardSummaries(), degrading to just the default label + "Otra…" when none exist; exports computeBatchTotal() and buildBatchDisplay() — the title/fields builder reused by both proposal creation and every post-mutation re-render in apply-batch-edit.ts), counterparty-rules.ts (resolveCreate/Update/DeleteCounterpartyRule — category-name resolution that BLOCKS instead of falling back on no match, ADR-032), undo.ts, index.ts (RESOLVER_REGISTRY + resolveComplexProposal() dispatch, now threading a channel param through to resolveAddTransaction for ADR-033's PendingProposal.channel — re-exports every resolver; ADR-034 adds propose_add_transactions_batch → resolveAddTransactionsBatch)
      auto-record-transaction.ts — (new, ADR-033) autoRecordFromRule({amount, date, note?, rule, channel}): the counterparty-rule auto-record side effect — createTransaction() using the RULE's category/wallet, bumpCounterpartyRuleMatch(), and persists an already-`status: "approved"` PendingProposal with params.createdId (the exact shape undoAddTransaction expects) plus the same category editable[] shape a normal card carries (so the notification's ✏️ button can reuse eopen:0). isConfidentTransaction(amount, date): simple sanity check (finite amount, parseable date), not a scoring system.
      run-agent-turn.ts     — Channel-agnostic tool-use loop orchestrator: derives PROPOSAL_TOOLS from PROPOSAL_ACTIONS, processReadToolBlock/processProposalToolBlock/processToolUseBlocks, persists PendingProposal (now incl. editable, ADR-031) on each proposal tool call, runAgentTurn(); previously a 1,200+ line god-file mixing tool dispatch/resolution/formatting/orchestration, split into the sibling files above (tools.ts, read-tools.ts, formatting.ts, proposals/). processProposalToolBlock now checks resolved?.autoRecorded before the normal params/title/fields path (ADR-033) — short-circuits to the tool_result message with no card and no second PendingProposal row; runAgentTurn collects these into AgentTurnResult.autoRecorded. `runAgentTurn`'s `messages[].content` is now typed as the Anthropic SDK's own `MessageParam["content"]` (string | content-block array) instead of a hard-coded `string` — additive widening, not a breaking change, so every existing string-only call site (web, Telegram, ingest) keeps compiling unchanged. This lets the LIVE incoming message (never a history row) carry an image content block for the card-screenshot photo path (image ingestion, Part 1). `deduplicateHistory` is now generic over `{ role }` so it works unchanged against both the plain-string and widened-content message shapes. Since ADR-034, processProposalToolBlock also threads `resolved.params.batch` (when present) onto the persisted PendingProposal and the returned ProposalDescriptor.batch — additive alongside the existing autoRecorded/editable branches.
      execute-proposal.ts   — resolveProposal(): looks up PendingProposal, dispatches via PROPOSAL_ACTIONS registry, marks approved/dismissed; used by both web and Telegram. Since ADR-033, also returns an optional learnRuleNudge string on a successful propose_add_transaction approve when params.hadCounterpartyMatch === false and a counterparty was extracted — the learn-from-corrections trigger (Part 3). Since ADR-034, the dispatch step (factored into executeApprovedAction()) also supports a generic message escape hatch: if an action's execute() returns a `message` field in its extra-fields object, that string replaces the hardcoded "Approved" default (used by the batch's "Agregadas N · Total X" reply) — `message` itself is stripped before the rest of `extra` is persisted onto params. propose_add_transaction's learnRuleNudge is unaffected — a separate field, not this mechanism.
      apply-proposal-edit.ts — applyProposalEdit(proposalId, field, optionId) (ADR-031): the one shared mutation for editable proposal cards — updates params[field] + editable[fieldIndex].selectedId, rejects a non-pending proposal or unknown field/option, returns a re-rendered ProposalDescriptor. Used by both the Telegram callback handler and POST /api/proposals/edit. Since ADR-033, ALSO accepts a proposal with status "approved" when its action is in REVERSIBLE_ACTIONS and params.createdId is present (the auto-record case) — additionally calls updateTransactionCategory() to patch the already-created live Transaction row in that branch.
      apply-batch-edit.ts   — (new, ADR-034) toggleBatchItem(proposalId, itemIdx), setBatchItemCategory(proposalId, itemIdx, optionIdx), setBatchCardLabel(proposalId, optionIdx): the shared mutation set for the batch card, mirroring apply-proposal-edit.ts's pattern — each reads/writes PendingProposal.params.batch and returns a re-rendered ProposalDescriptor (title/fields rebuilt via transactions-batch.ts's buildBatchDisplay()). Used identically by both the Telegram bt:/bs:/bc: callbacks and POST /api/proposals/batch-edit. Rejects a non-pending proposal, a proposal with no params.batch, or an out-of-range item/option index.
      deliver-to-telegram.ts — runTurnAndDeliverToTelegram(text, opts?): shared helper (ADR-028) — loads shared history (most-recent 20, reversed to chronological order — ADR-029), saveMessage, runAgentTurn({channel:"telegram"}), persists combined assistant turn, echoes ingested (shortcut-channel) text before the turn (ADR-029), delivers text + proposal cards to TELEGRAM_ALLOWED_CHAT_ID; used by both the Telegram webhook (handleTextMessage) and /api/ingest. Since ADR-033, also sends a dedicated auto-record notification (toTelegramAutoRecordMessage) for each entry in result.autoRecorded. New sibling `runImageTurnAndDeliverToTelegram(image, opts?)` (card-screenshot image ingestion, Part 1): echoes "📸 Leyendo el pantallazo…", persists a fixed text placeholder to ChatMessage (never raw base64 — no schema change), attaches an Anthropic image content block only to the live incoming message (history rows stay plain strings), and reuses the same delivery tail (`deliverResultToTelegram`, factored out of the text path) so text/proposal/auto-record delivery is identical between the text and image entry points. Since ADR-034, deliverResultToTelegram() renders a proposal via toTelegramBatchMessage() instead of toTelegramMessage() whenever proposal.batch is set.
    telegram/
      api.ts                — Telegram Bot API helpers: sendMessage, answerCallbackQuery, editMessageText, sendChatAction. Plus `getFile(fileId)` (resolves a Telegram file_id to a downloadable file_path via the Bot API) and `downloadFile(filePath)` (fetches the bytes from Telegram's separate file-host URL, returns `{ base64, mediaType }` — media type inferred from the file extension, defaulting to `image/jpeg` since Telegram always re-encodes photos server-side) — added for card-screenshot image ingestion, Part 1.
      render.ts             — toTelegramMessage(): converts ProposalDescriptor → Telegram text + inline_keyboard, incl. a ✏️ {label} button per editable field (ADR-031). toTelegramEditOptionsMessage(): the option-picker view for one editable field (✓ marks the current selection, plus a ⬅︎ Volver back button). callback_data uses indices, not ids: eopen:{fieldIdx}, e:{fieldIdx}:{optIdx}, eback. toTelegramAutoRecordMessage() (ADR-033): the "✅ Registrado…" auto-record notification with [✏️ Editar] [↩︎ Deshacer] — reuses the eopen:0 and undo:{proposalId} callback formats verbatim, no new format introduced. Since ADR-034: toTelegramBatchMessage() — the full batch review card (numbered list with ✓/✕ markers + ⚠︎ scratch-detected note, per-item toggle `bt:{idx}` + edit `be:{idx}` button pair capped at 30 rows, `💳 Tarjeta` → `bo`, Approve/Dismiss reusing the existing format); toTelegramBatchCategoryMessage() — category picker for one item (`bs:{idx}:{optIdx}`, back → `bback`); toTelegramBatchCardLabelMessage() — card-label picker (`bc:{optIdx}`, back → `bback`).
    actions/
      import.ts             — importMoneyLoverFile(), importBuffer() — now dedups MoneyLover rows against existing MANUAL transactions (same day + exact amount) before insert, returns { imported, skippedAsDuplicate, count } (ADR-030)
      drive.ts              — listDriveFiles(), importFromDrive()
      expenses.ts           — expense-related server actions
      categories.ts         — AppCategory + BudgetItem CRUD actions
      installments.ts       — Installment + InstallmentPayment CRUD actions
      loans.ts              — SavingsAccount, Debtor, Loan, LoanPayment, Transfer CRUD actions
      transactions.ts       — createTransaction(), deleteTransaction() (ADR-030): the bot/manual-capture write path — MANUAL source, batchId/externalId/moneyLoverCategoryId null, direct appCategoryId. updateTransactionCategory(id, appCategoryId) (ADR-033): patches the category on an already-created transaction — the live-entity sync step for editing an auto-recorded transaction. updateTransaction(id, { amount?, date?, appCategoryId?, wallet?, note? }) (new, ADR-035): general partial-update for the Ledger's row-edit action — detach-on-edit rule: editing a MONEYLOVER row also flips source→MANUAL and nulls batchId/moneyLoverCategoryId in the same update (resolving a fallback appCategoryId via the ADR-030 rule when the caller didn't supply one), so the edit is authoritative and the existing import dedup (ADR-030) treats it as already-captured on re-import; a MANUAL row is a plain partial update with no source flip.
      chat.ts               — saveMessage()
      vaults.ts             — createVault(), updateVault(), archiveVault(), addVaultEntry(vaultId, amount, date?, notes?, sourceAccountId?) — 5th arg optional; revalidates /loans, deleteVaultEntry()
      recurring.ts          — createRecurringExpense(), updateRecurringExpense(), deleteRecurringExpense(), payRecurringExpense() (atomic via prisma.$transaction)
      counterparty-rules.ts — createCounterpartyRule(), updateCounterpartyRule(id, data), deleteCounterpartyRule(id) (ADR-032): CRUD over CounterpartyRule; create/update always normalize matchValue via normalizeMatchValue() before writing; revalidates /settings/rules
  generated/
    prisma/                 — Prisma-generated client (do not edit manually)
  hooks/
    use-mobile.ts           — Breakpoint hook for sidebar collapse
```

## Module breakdown

### `src/app/(app)/overview`
**Responsibility:** Home dashboard. Aggregates data from all modules into a single-page health summary. Uses an asymmetric 7/5 grid layout with a `BudgetBarsPanel` (variable/fixed burn rates + savings rate bars) and `TopUnplannedPanel` (top unplanned spending). Installments split into Upcoming/Paid columns. Loans section shows a Liquidity Health panel. Mounts `VaultDueBanner` at the top when vault obligations are still needed this month.
**Key files:** `overview/page.tsx` → `components/overview/overview-dashboard.tsx` (contains `BudgetBarsPanel`, `TopUnplannedPanel` as module-private components), `components/overview/expense-donut.tsx` (horizontal layout, Total Spent center label, two-row legend), `components/overview/forecast-panel.tsx` (server component; shows projected savings rate, vsTarget delta, and top overspend drivers; renders a quiet thin-data state when < 3 months of history)
**Dependencies:** `getMonthlyAnalysis`, `getMonthSummary`, `getLoansOverview`, `getHealthScore`, `getVaultObligations`, `getForecast`
**Exports:** `OverviewPage` (route), `OverviewDashboard` (async Server Component), `ExpenseDonut` (Recharts pie chart), `ForecastPanel` (async Server Component)

---

### `src/app/(app)/expenses`
**Responsibility:** Monthly expense analysis and a granular transaction ledger. `expenses/page.tsx` now has two tabs (`?view=analysis|ledger`, default `analysis` so existing links are unaffected), switched via `ViewTabs`: **Analysis** shows the existing income/expenses/category-health breakdown; **Ledger** (new, ADR-035) shows the month's transactions grouped by day/category/wallet with filters and per-row edit/delete.
**Key files:** `expenses/page.tsx`, `components/expenses/import-form.tsx` (client), `components/expenses/analysis-dashboard.tsx` (server — `StatCard` now exported for reuse by the Ledger header band), `components/expenses/category-breakdown-table.tsx`, `components/expenses/period-selector.tsx`, `components/expenses/view-tabs.tsx` (new, client — Analysis/Ledger tab pair; plain buttons with the active-nav-item color treatment, not a new Tabs primitive), `components/expenses/transaction-ledger.tsx` (new, server — `TransactionLedgerPage`: fetches `getTransactionList` twice — once for the active groupBy/filters, once ungrouped-by-wallet with no filters purely to derive the full month's distinct wallet labels for `WalletSelect` — plus `getCategories()`; renders the Income/Expenses `StatCard`s, the informational `CategorySummaryPanel`, and `LedgerControls` wrapping either `TransactionGroupList` or `LedgerEmptyState`), `components/expenses/ledger-controls.tsx` (new, client — `GroupByToggle` + `FilterBar` (category/wallet/type selects + a 300ms-debounced search input), all driving the same `?groupBy=&category=&wallet=&type=&search=` search-param contract via `router.push` + `useTransition`; dims the group-list region — `opacity-50 pointer-events-none`, no spinner — while a navigation is pending), `components/expenses/transaction-group-list.tsx` (new, client — renders one section per group with a Slate-Raised header strip showing the label + `text-lg` mono subtotal, sign-colored), `components/expenses/transaction-row.tsx` (new, client — `TransactionRow`: default / inline-edit / inline-delete-confirm states per row, adapted from `rule-list.tsx`'s `RuleRow` pattern; redundant-column suppression by `groupBy` — day mode hides the date column, category mode hides the category chip, wallet mode hides the wallet tag; `Escape` cancels edit/delete-confirm back to default; deleting focuses the row's "No" button by default, not "Yes"; a `source === "MANUAL"` row gets a plain "manual" caption tag, MoneyLover rows get nothing), `components/expenses/ledger-empty-state.tsx` (new, client — two copy variants: no data this period vs. no match for filters + a "Clear filters" reset)
**Dependencies:** `getMonthlyAnalysis`, `getImportBatches`, `importMoneyLoverFile`, `listDriveFiles`, `importFromDrive`, `getTransactionList`, `getCategories`, `updateTransaction`, `deleteTransaction`
**Exports:** `ExpensesPage` (route)

---

### `src/app/(app)/trends`
**Responsibility:** Multi-month charts showing income, expenses, budget, net, savings rate trends over 3/6/12 months, plus per-category spend trends.
**Key files:** `trends/page.tsx`, `components/trends/trends-dashboard.tsx`
**Dependencies:** `getTrends(n)` — fetches the n most recent import batches
**Exports:** `TrendsPage` (route, reads `?period` search param)

---

### `src/app/(app)/installments`
**Responsibility:** Tracks deferred purchases split into monthly payments. Shows a Credit Overview section (credit card tiles + KPI band), a monthly obligation summary (total due, paid, remaining), lists all active and finished installments, and allows marking payments. Supports per-card filtering client-side.
**Key files:** `installments/page.tsx`, `components/installments/installments-dashboard.tsx` (client component), `installment-form.tsx`, `installment-actions.tsx`, `pay-button.tsx`, `month-nav.tsx`, `all-installments-table.tsx`, `credit-card-tile.tsx`, `credit-card-manager.tsx`
**Dependencies:** `getAllInstallments`, `getMonthSummary`, `getCardSummaries`, `computeInstallmentDue`, `computeMonthSummary`, CreditCard CRUD actions
**Exports:** `InstallmentsPage` (route)

---

### `src/app/(app)/loans`
**Responsibility:** Tracks personal savings accounts and money lent to debtors. Shows account balances (computed from ledger), outstanding loans per debtor, KPIs (available, in loans, liquidity ratio, earmarked in vaults, net worth), and allows full CRUD on accounts, debtors, loans, payments, and transfers. The "Entry log" dialog in `account-card.tsx` shows a unified sorted list of `AccountEntry` records (INITIAL/ADJUSTMENT badges) and sourced vault contributions (`VaultEntry` rows with a "Vault" badge and vault name; no delete — vault entries are managed from the Vaults module).
**Key files:** `loans/page.tsx`, `components/loans/loans-dashboard.tsx`, `loans-client.tsx`, `account-card.tsx`, `debtor-form.tsx`, `loan-form.tsx`, `payment-form.tsx`, `entry-form.tsx`, `account-form.tsx`, `loan-row-actions.tsx`
**Dependencies:** `getLoansOverview`
**Exports:** `LoansPage` (route)

---

### `src/app/(app)/vaults`
**Responsibility:** Goal-based savings pockets. Shows a KPI band (total balance, mandatory still-needed, leisure still-needed) and a tile grid — one tile per vault with SVG progress ring, status badge, kind chip, and balance/target/required-this-month figures. Supports full CRUD (create, edit, archive) and a ledger sheet per vault for contributions and withdrawals. The "Ask agent" button on `VaultDueBanner` opens the chat pre-scoped to the relevant vault. Contributions optionally name a source savings account ("From account" picker in `entry-form.tsx`) — sourced entries are real money moves (ADR-021).
**Key files:** `vaults/page.tsx`, `components/vaults/vaults-dashboard.tsx` (client), `vault-tile.tsx`, `vault-form.tsx`, `entry-form.tsx`, `vault-ledger.tsx`, `vault-due-banner.tsx`
**Dependencies:** `getVaults`, `getVaultObligations`, `getSavingsAccounts`, `createVault`, `updateVault`, `archiveVault`, `addVaultEntry`, `deleteVaultEntry`
**Exports:** `VaultsPage` (route), `VaultDueBanner` (also mounted in overview)

---

### `src/app/(app)/chat`
**Responsibility:** Full-screen AI advisor backed by `claude-sonnet-4-6`. Uses a channel-agnostic tool-use loop (14 read tools + 19 proposal tools, including the ADR-027 `propose_account_adjustment`/`propose_transfer` pair, the ADR-030/031 `get_categories`/`propose_add_transaction` pair, the ADR-032 `get_counterparty_rules` + `propose_create/update/delete_counterparty_rule` trio, and the ADR-034 `propose_add_transactions_batch`), orchestrated by `src/lib/agent/run-agent-turn.ts` and split across `src/lib/agent/{tools,read-tools,formatting}.ts` and `src/lib/agent/proposals/`. Conversation history is persisted in `ChatMessage` (shared across web, Telegram, and Shortcut ingest), capped at the 20 most **recent** messages, chronologically ordered (ADR-029 — previously the 20 oldest, a bug that made the agent blind to recent context in long conversations). The web route (`src/app/api/chat/route.ts`) persists a combined assistant-turn record — text plus a `[Proposed: ...]` summary line per proposal — instead of only the text reply, so a turn whose sole output was a proposal still threads into history (ADR-027; previously such turns vanished from the 20-message window, causing the model to re-ask). The Telegram and Shortcut-ingest entry points share this same behavior via `runTurnAndDeliverToTelegram()` (ADR-028) rather than duplicating it. The floating chat panel is available on every page, module-context-aware. Proposal tools persist a `PendingProposal` record (now optionally with `editable`, ADR-031, or `batch`, ADR-034) and surface action cards (`ActionCard`) that the user must approve before mutations occur (ADR-015). Approval calls `POST /api/proposals/resolve` which runs the unified `resolveProposal()` (ADR-022); an in-place field edit calls `POST /api/proposals/edit` which runs `applyProposalEdit()` — this mutates only the pending proposal's draft, never approves (ADR-031). A batch proposal (`propose_add_transactions_batch`, ADR-034) renders differently: `ActionCard` branches on `proposal.batch` and delegates to `BatchProposalTable` (`components/chat/batch-proposal-table.tsx`) instead of the generic fields/editable display — a table of vendor/amount/category rows, each with a checkbox (include) and a category `<select>`, plus a batch-level card-label `<select>` and a live running total computed from `batch.items` client-side. Every checkbox/select edit POSTs immediately to `POST /api/proposals/batch-edit` (`{ proposalId, op: "toggle"|"setCategory"|"setCardLabel", itemIdx?, optionIdx? }`) and merges the returned `ProposalDescriptor` back into `ChatProvider` state via `updateProposalDescriptor` — the same request/response/state-merge pattern `EditableFieldSelect` established for ADR-031, adapted for the batch's many-items shape. Approve/dismiss for a batch proposal reuse `POST /api/proposals/resolve` completely unchanged. `ActionCard`'s approved state now also displays `resolvedMessage` (the `message` returned by `/api/proposals/resolve`) below the "Approved" badge whenever it differs from the generic `"Approved"` string — for most actions this is a no-op (the message IS `"Approved"`), but for a batch proposal it surfaces the required "✅ Agregadas N · Total $X · mueve $X a tu pocket de Bancolombia." summary persistently instead of only as an ephemeral toast.
**Key files:** `chat/page.tsx`, `components/chat/chat-provider.tsx` (NDJSON streaming + proposal state, incl. `batch`/`resolvedMessage` on `ProposalEvent`), `chat-messages.tsx`, `chat-input.tsx`, `floating-chat.tsx`, `action-card.tsx` (branches on `proposal.batch`), `batch-proposal-table.tsx` (new, ADR-034 — the interactive batch table), `src/app/api/chat/route.ts` (thin streaming wrapper; NDJSON proposal event includes `batch: p.batch` alongside `editable`), `src/app/api/proposals/resolve/route.ts` (web approve path), `src/app/api/proposals/batch-edit/route.ts` (web batch-edit path, ADR-034), `src/lib/agent/run-agent-turn.ts` (tool-use loop orchestrator), `src/lib/agent/tools.ts` (tool JSON schemas), `src/lib/agent/read-tools.ts` (read-tool dispatch), `src/lib/agent/formatting.ts` (proposal display formatting), `src/lib/agent/proposals/` (complex resolvers by domain), `src/lib/agent/execute-proposal.ts` (unified write path), `src/lib/agent/deliver-to-telegram.ts` (shared Telegram-delivery helper, ADR-028)
**Dependencies:** All agent read queries, vault + recurring write actions, Anthropic SDK, Prisma (PendingProposal)
**Exports:** `ChatPage` (route), `FloatingChat`, `ActionCard`, `BatchProposalTable`
**Transport:** `application/x-ndjson` — one JSON object per line: `{"type":"text","delta":"..."}` or `{"type":"proposal","proposalId":"...","action":"...","params":{...},"label":"...","batch":{...}?}` (`batch` present only for `propose_add_transactions_batch`, ADR-034)

---

### `src/app/api/telegram`
**Responsibility:** Telegram webhook for the multi-channel agent (ADR-022). Receives `message` and `callback_query` updates from Telegram, verifies the secret token and the hard-allowlisted `chat_id`, and dispatches to the shared agent core. Text messages are a thin wrapper over the shared `runTurnAndDeliverToTelegram()` helper (ADR-028, also used by `/api/ingest`); inline keyboard taps → `resolveProposal()` → `answerCallbackQuery` + `editMessageText`. Both the main text-message path (inside the shared helper) and the undo callback path persist a combined assistant-turn record (text + proposal summary) via `saveAssistantTurn()`, not just the text reply (ADR-027). Uses `after()` (Next.js) for fast-ack + async work pattern (Vercel-compatible).
**Key files:** `src/app/api/telegram/route.ts`, `src/lib/agent/deliver-to-telegram.ts` (shared helper), `src/lib/telegram/api.ts`, `src/lib/telegram/render.ts`
**Env vars required:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`

---

### `src/app/api/ingest`
**Responsibility:** External text ingress for the multi-channel agent (ADR-028) — a third channel over `runAgentTurn()`, for clients that aren't the web app or Telegram (e.g. an iPhone Shortcut forwarding a bank notification). `POST /api/ingest` requires `Authorization: Bearer <INGEST_SECRET>`; missing/mismatched → `401` with no side effects. Body `{ text: string }`; missing/empty/whitespace-only → `400`. On success, returns `200 { ok: true }` immediately and runs `runTurnAndDeliverToTelegram(text, { channel: "shortcut" })` inside `after()`, so the reply/proposal is delivered to Telegram exactly like a normal Telegram message — same shared history, same propose-then-confirm gate. No idempotency guard (the Shortcut fires once per message, unlike Telegram's retry-prone webhook).
**Key files:** `src/app/api/ingest/route.ts`, `src/app/api/ingest/route.test.ts`, `src/lib/agent/deliver-to-telegram.ts` (shared helper)
**Env vars required:** `INGEST_SECRET`

---

### `src/app/(app)/settings`
**Responsibility:** Configuration for the expense categorization system. Two sub-pages today: AppCategory CRUD (with BudgetItem line items) and MoneyLover→AppCategory mapping management. A third sub-page, `settings/rules/page.tsx` (CounterpartyRule CRUD, ADR-032), is a **follow-up for a later Frontend pass** — the data/action/agent-tool layer it will consume (`getCounterpartyRules()`, `createCounterpartyRule`/`updateCounterpartyRule`/`deleteCounterpartyRule`) already exists as of this pass, but the page itself is not yet built.
**Key files:** `settings/categories/page.tsx`, `settings/mappings/page.tsx`, `components/settings/category-list.tsx`, `mapping-list.tsx`
**Dependencies:** `categories.ts` actions, `getUnmappedCategories`
**Exports:** `CategoriesPage`, `MappingsPage` (routes)

---

### `src/lib/queries/`
**Responsibility:** All read-only database queries. Pure async functions returning typed data. Called directly inside Server Components.
**Key files:**
- `expenses.ts` — `getMonthlyAnalysis()`: full budget/actual/severity breakdown for one month, date-range scoped via `getFinancialPeriodBounds()` so MANUAL transactions are included (ADR-030); `getImportBatches()`, `getAvailableMonths()` (unions ImportBatch + MANUAL-transaction months), `getCategories()` (`CategoryOption[]` — id/name/budgetType, for `get_categories` and the transaction-proposal shortlist), `getUnmappedCategories()`
- `installments.ts` — `getAllInstallments()`: status-enriched list; `getMonthSummary()`: obligations for a given month; `getCardSummaries(month, year)`: per-card outstanding debt + monthly obligation; `getInstallmentFormData()`: cards/debtors/accounts for form pickers
- `loans.ts` — `getLoansOverview()`: accounts with computed balances (now subtracts `vaultFundedNet` per account), debtors with computed loan remainders, portfolio KPIs. Now returns `inVaults` (total sourced vault money across accounts) and `netWorth = totalSavings + inVaults`. `totalSavings` and `liquidityRatio` are unchanged (ADR-011 untouched).
- `accounts.ts` — `getSavingsAccounts()`: lightweight list of `{ id, name, balance }` for picker UIs. Uses the same balance formula as `loans.ts` (including `vaultFundedNet` deduction).
- `trends.ts` — `getTrends(n)`: per-month income/expense/budget/savings-rate + per-category spend across n months, date-range scoped like `getMonthlyAnalysis` (ADR-030)
- `health-score.ts` — `getHealthScore()`: composite 0–100 score with month-over-month delta
- `chat.ts` — `getFinancialSnapshot()`: plain-text financial summary (used by the `get_overview` agent tool), date-range scoped + null-safe category resolution so manual transactions are included (ADR-030)
- `vaults.ts` — `getVaults()`: all active vaults with computed `VaultWithMetrics` (balance, remaining, progress %, status, contributedThisMonth). `VaultEntryRow` now includes `sourceAccountId` and `sourceAccountName`; entries include the `sourceAccount` relation. `getVaultObligations(month, year)`: per-vault required/contributed/stillNeeded totals.
- `forecast.ts` — `getForecast(month, year)`: historical projection using trend history + budget structure. Reuses `getTrends` + `getMonthlyAnalysis`. No new DB shape. Returns `ForecastResult` with per-category predictions, projected savings rate, vsTarget/vsLastMonth deltas, overspend drivers, and `dataSufficiency` flag.
- `transactions.ts` — (new, ADR-035) `getTransactionList(month, year, groupBy, filters)`: the granular ledger view backing the expenses module's Ledger tab (`components/expenses/transaction-ledger.tsx`). Date-range scoped and category-resolved exactly like `getMonthlyAnalysis`; groups by day/category/wallet, applies filters before grouping, returns filter-independent whole-month totals plus a filter-aware `categorySummary`.

---

### `src/lib/actions/`
**Responsibility:** All write operations exposed as Next.js Server Actions (or API route handlers for streaming). Call `revalidatePath` after mutations.
**Key files:**
- `import.ts` — `importMoneyLoverFile()` / `importBuffer()`: parse XLSX → upsert categories → replace batch → insert transactions. Now skips a parsed row as a duplicate when a MANUAL transaction already matches on the same calendar day + exact amount (backfill dedup, ADR-030); returns `{ imported, skippedAsDuplicate, count }`.
- `drive.ts` — `listDriveFiles()` / `importFromDrive()`: Google Drive service account integration
- `categories.ts` — AppCategory and BudgetItem create/update/delete
- `installments.ts` — Installment CRUD (`createInstallment`, `updateInstallment`, `deleteInstallment`); payment actions (`markPayment` — auto-creates a Loan record when debtorId + fundingAccountId are set, `unmarkPayment`); CreditCard CRUD (`createCard`, `updateCard`, `deleteCard`)
- `loans.ts` — SavingsAccount, AccountEntry, Transfer, Debtor, Loan, LoanPayment CRUD
- `transactions.ts` — `createTransaction({ amount, date, appCategoryId, wallet, note? })` (ADR-030): creates a MANUAL row (`batchId`/`externalId`/`moneyLoverCategoryId: null`), revalidates `/expenses`, `/overview`, `/trends`; `deleteTransaction(id)` for undo
- `counterparty-rules.ts` — `createCounterpartyRule()`, `updateCounterpartyRule(id, data)`, `deleteCounterpartyRule(id)` (ADR-032): CRUD over `CounterpartyRule`; create/update always normalize `matchValue` via `normalizeMatchValue()` before writing; revalidates `/settings/rules`
- `chat.ts` — `saveMessage()`: persist a single ChatMessage row
- `vaults.ts` — `createVault()`, `updateVault()`, `archiveVault()` (sets archivedAt), `addVaultEntry()` (signature: `vaultId, amount, date?, notes?, sourceAccountId?` — rejects withdrawal driving balance < 0), `deleteVaultEntry()`; all revalidate `/vaults`, `/overview`, and `/loans` (the last because sourced contributions change account balances)

---

### `src/lib/installment-utils.ts`
**Responsibility:** Pure math for German amortization and month filtering. Safe to import in any context (server, client, test).
**Key exports:**
- `computeMonthlyAmount(total, n)` — capital per payment (P/n)
- `computeInstallmentDue(total, n, k, rate?)` — total due for the kth payment with optional interest
- `isDueInMonth(startDate, installmentNum, month, year)` — true if payment slot n falls in the given month/year
- `computeMonthSummary(month, year, installments)` — synchronous client-safe recompute of `MonthSummary` from a pre-fetched array (used for client-side card filtering)
- `eaToMonthly(ea)` / `monthlyToEA(monthly)` — interest rate conversions

---

### `src/lib/vault-utils.ts`
**Responsibility:** Pure math for vault metrics and status classification. Client-safe — no Prisma imports.
**Key exports:**
- `VaultStatus` — `"Met" | "On track" | "Behind" | "Overdue" | "Open" | "Underfunded"`
- `computeVaultMetrics(vault, balance, month, year, recurringRequired?)` — returns `{ balance, remaining, monthsLeft, requiredThisMonth, progressPct }`. For RECURRING vaults, pass `recurringRequired` (sum of set-asides from linked expenses).
- `classifyVault(vault, balance, contributedThisMonth, month, year, requiredThisMonth?)` — returns `VaultStatus`. RECURRING: `Underfunded` when behind, `On track` otherwise.
- `monthsLeft(targetDate, month, year)` — integer months until deadline from the given reference month

---

### `src/lib/recurring-utils.ts`
**Responsibility:** Pure math for the Recurring Expenses module. Client-safe — no Prisma imports.
**Key exports:**
- `monthsUntilDue(nextDueDate, month, year)` — whole months from (month,year) to dueDate, min 1
- `monthlySetAside(estimatedAmount, nextDueDate, month, year)` — `estimatedAmount / monthsUntilDue`
- `isDueInMonth(nextDueDate, month, year)` — true if nextDueDate falls within the given month
- `rollCycle(nextDueDate, cadenceMonths)` — new Date advanced by cadenceMonths; used after payment

---

### `src/lib/parse-moneylover.ts`
**Responsibility:** Parses a MoneyLover XLSX buffer into a structured `ParsedMoneyLover` object. Handles period boundary detection (configurable `FINANCIAL_MONTH_START_DAY` env var), discovers categories dynamically, and normalizes rows.
**Dependencies:** `xlsx` package
