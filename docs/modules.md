# Modules

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
    api/
      chat/route.ts         — NDJSON tool-use loop (read + proposal tools)
  components/
    app-sidebar.tsx         — Sidebar nav + theme toggle
    overview/               — OverviewDashboard (BudgetBarsPanel, TopUnplannedPanel), ExpenseDonut
    expenses/               — ImportForm, AnalysisDashboard, CategoryBreakdownTable, PeriodSelector
    trends/                 — TrendsDashboard (Recharts)
    installments/           — InstallmentsDashboard (client), InstallmentForm, PayButton, MonthNav, AllInstallmentsTable, InstallmentActions, CreditCardTile, CreditCardManager
    loans/                  — LoansDashboard, AccountCard, DebtorForm, LoanForm, PaymentForm, EntryForm, AccountForm, TransferForm, LoansClient, LoanRowActions
    vaults/                 — VaultsDashboard (client), VaultTile, VaultForm, EntryForm, VaultLedger, VaultDueBanner, RecurringList, RecurringExpenseForm
    settings/               — CategoryList, MappingList
    chat/                   — FloatingChat, ChatProvider, ChatMessages, ChatInput, ActionCard
    ui/                     — shadcn/ui base-nova primitives
  lib/
    db.ts                   — Prisma client singleton
    format.ts               — formatCOP(), formatShort(), MONTH_NAMES
    utils.ts                — cn() (clsx + tailwind-merge)
    installment-utils.ts    — computeMonthlyAmount(), computeInstallmentDue(), isDueInMonth(), computeMonthSummary(), rate converters
    vault-utils.ts          — computeVaultMetrics(), classifyVault(), monthsLeft() — pure math, client-safe
    parse-moneylover.ts     — XLSX → Transaction[] parser
    queries/
      expenses.ts           — getMonthlyAnalysis(), getImportBatches(), getUnmappedCategories()
      installments.ts       — getAllInstallments(), getMonthSummary()
      loans.ts              — getLoansOverview()
      trends.ts             — getTrends()
      health-score.ts       — getHealthScore()
      chat.ts               — getFinancialSnapshot()
      vaults.ts             — getVaults() (branches on goalType: RECURRING uses summed set-asides), getVaultObligations()
      recurring.ts          — getRecurringExpenses(month, year): items with set-aside + status
    actions/
      import.ts             — importMoneyLoverFile(), importBuffer()
      drive.ts              — listDriveFiles(), importFromDrive()
      expenses.ts           — expense-related server actions
      categories.ts         — AppCategory + BudgetItem CRUD actions
      installments.ts       — Installment + InstallmentPayment CRUD actions
      loans.ts              — SavingsAccount, Debtor, Loan, LoanPayment, Transfer CRUD actions
      chat.ts               — saveMessage()
      vaults.ts             — createVault(), updateVault(), archiveVault(), addVaultEntry(), deleteVaultEntry()
      recurring.ts          — createRecurringExpense(), updateRecurringExpense(), deleteRecurringExpense(), payRecurringExpense() (atomic via prisma.$transaction)
  generated/
    prisma/                 — Prisma-generated client (do not edit manually)
  hooks/
    use-mobile.ts           — Breakpoint hook for sidebar collapse
```

## Module breakdown

### `src/app/(app)/overview`
**Responsibility:** Home dashboard. Aggregates data from all modules into a single-page health summary. Uses an asymmetric 7/5 grid layout with a `BudgetBarsPanel` (variable/fixed burn rates + savings rate bars) and `TopUnplannedPanel` (top unplanned spending). Installments split into Upcoming/Paid columns. Loans section shows a Liquidity Health panel. Mounts `VaultDueBanner` at the top when vault obligations are still needed this month.
**Key files:** `overview/page.tsx` → `components/overview/overview-dashboard.tsx` (contains `BudgetBarsPanel`, `TopUnplannedPanel` as module-private components), `components/overview/expense-donut.tsx` (horizontal layout, Total Spent center label, two-row legend)
**Dependencies:** `getMonthlyAnalysis`, `getMonthSummary`, `getLoansOverview`, `getHealthScore`, `getVaultObligations`
**Exports:** `OverviewPage` (route), `OverviewDashboard` (async Server Component), `ExpenseDonut` (Recharts pie chart)

---

### `src/app/(app)/expenses`
**Responsibility:** Monthly expense analysis. Lets the user import an XLSX from MoneyLover (local upload or Google Drive), then shows a full breakdown of income, expenses, category health, top offenders, savings metrics, and fixed/variable subtotals.
**Key files:** `expenses/page.tsx`, `components/expenses/import-form.tsx` (client), `components/expenses/analysis-dashboard.tsx` (server), `components/expenses/category-breakdown-table.tsx`, `components/expenses/period-selector.tsx`
**Dependencies:** `getMonthlyAnalysis`, `getImportBatches`, `importMoneyLoverFile`, `listDriveFiles`, `importFromDrive`
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
**Responsibility:** Tracks personal savings accounts and money lent to debtors. Shows account balances (computed from ledger), outstanding loans per debtor, KPIs (available, in loans, liquidity ratio), and allows full CRUD on accounts, debtors, loans, payments, and transfers.
**Key files:** `loans/page.tsx`, `components/loans/loans-dashboard.tsx`, `loans-client.tsx`, `account-card.tsx`, `debtor-form.tsx`, `loan-form.tsx`, `payment-form.tsx`, `entry-form.tsx`, `account-form.tsx`, `loan-row-actions.tsx`
**Dependencies:** `getLoansOverview`
**Exports:** `LoansPage` (route)

---

### `src/app/(app)/vaults`
**Responsibility:** Goal-based savings pockets. Shows a KPI band (total balance, mandatory still-needed, leisure still-needed) and a tile grid — one tile per vault with SVG progress ring, status badge, kind chip, and balance/target/required-this-month figures. Supports full CRUD (create, edit, archive) and a ledger sheet per vault for contributions and withdrawals. The "Ask agent" button on `VaultDueBanner` opens the chat pre-scoped to the relevant vault.
**Key files:** `vaults/page.tsx`, `components/vaults/vaults-dashboard.tsx` (client), `vault-tile.tsx`, `vault-form.tsx`, `entry-form.tsx`, `vault-ledger.tsx`, `vault-due-banner.tsx`
**Dependencies:** `getVaults`, `getVaultObligations`, `createVault`, `updateVault`, `archiveVault`, `addVaultEntry`, `deleteVaultEntry`
**Exports:** `VaultsPage` (route), `VaultDueBanner` (also mounted in overview)

---

### `src/app/(app)/chat`
**Responsibility:** Full-screen AI advisor backed by `claude-sonnet-4-6`. Uses a tool-use loop (9 read tools + 5 proposal tools). Conversation history is persisted in `ChatMessage`. The floating chat panel is available on every page, module-context-aware. Proposal tools surface action cards (`ActionCard`) that the user must approve before mutations occur (ADR-015).
**Key files:** `chat/page.tsx`, `components/chat/chat-provider.tsx` (NDJSON streaming + proposal state), `chat-messages.tsx`, `chat-input.tsx`, `floating-chat.tsx`, `action-card.tsx`, `src/app/api/chat/route.ts`
**Dependencies:** `getFinancialSnapshot`, `getHealthScore`, `getMonthlyAnalysis`, `getTrends`, `getAllInstallments`, `getLoansOverview`, `getVaults`, `getVaultObligations`, vault write actions, Anthropic SDK
**Exports:** `ChatPage` (route), `FloatingChat` (accessible from any page via the app layout), `ActionCard` (renders proposal events inline in the chat stream)
**Transport:** `application/x-ndjson` — one JSON object per line: `{"type":"text","delta":"..."}` or `{"type":"proposal","action":"...","params":{...},"label":"..."}`

---

### `src/app/(app)/settings`
**Responsibility:** Configuration for the expense categorization system. Two sub-pages: AppCategory CRUD (with BudgetItem line items) and MoneyLover→AppCategory mapping management.
**Key files:** `settings/categories/page.tsx`, `settings/mappings/page.tsx`, `components/settings/category-list.tsx`, `mapping-list.tsx`
**Dependencies:** `categories.ts` actions, `getUnmappedCategories`
**Exports:** `CategoriesPage`, `MappingsPage` (routes)

---

### `src/lib/queries/`
**Responsibility:** All read-only database queries. Pure async functions returning typed data. Called directly inside Server Components.
**Key files:**
- `expenses.ts` — `getMonthlyAnalysis()`: full budget/actual/severity breakdown for one month; `getImportBatches()`, `getUnmappedCategories()`
- `installments.ts` — `getAllInstallments()`: status-enriched list; `getMonthSummary()`: obligations for a given month; `getCardSummaries(month, year)`: per-card outstanding debt + monthly obligation; `getInstallmentFormData()`: cards/debtors/accounts for form pickers
- `loans.ts` — `getLoansOverview()`: accounts with computed balances, debtors with computed loan remainders, portfolio KPIs
- `trends.ts` — `getTrends(n)`: per-month income/expense/budget/savings-rate + per-category spend across n months
- `health-score.ts` — `getHealthScore()`: composite 0–100 score with month-over-month delta
- `chat.ts` — `getFinancialSnapshot()`: plain-text financial summary (used by the `get_overview` agent tool)
- `vaults.ts` — `getVaults()`: all active vaults with computed `VaultWithMetrics` (balance, remaining, progress %, status, contributedThisMonth); `getVaultObligations(month, year)`: per-vault required/contributed/stillNeeded totals

---

### `src/lib/actions/`
**Responsibility:** All write operations exposed as Next.js Server Actions (or API route handlers for streaming). Call `revalidatePath` after mutations.
**Key files:**
- `import.ts` — `importMoneyLoverFile()` / `importBuffer()`: parse XLSX → upsert categories → replace batch → insert transactions
- `drive.ts` — `listDriveFiles()` / `importFromDrive()`: Google Drive service account integration
- `categories.ts` — AppCategory and BudgetItem create/update/delete
- `installments.ts` — Installment CRUD (`createInstallment`, `updateInstallment`, `deleteInstallment`); payment actions (`markPayment` — auto-creates a Loan record when debtorId + fundingAccountId are set, `unmarkPayment`); CreditCard CRUD (`createCard`, `updateCard`, `deleteCard`)
- `loans.ts` — SavingsAccount, AccountEntry, Transfer, Debtor, Loan, LoanPayment CRUD
- `chat.ts` — `saveMessage()`: persist a single ChatMessage row
- `vaults.ts` — `createVault()`, `updateVault()`, `archiveVault()` (sets archivedAt), `addVaultEntry()` (rejects withdrawal driving balance < 0), `deleteVaultEntry()`; all revalidate `/vaults` and `/overview`

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
