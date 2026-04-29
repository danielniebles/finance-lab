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
      chat/page.tsx         — Full-screen AI advisor chat
      settings/
        categories/page.tsx — AppCategory + BudgetItem CRUD
        mappings/page.tsx   — MoneyLoverCategory → AppCategory mapping
    api/
      chat/route.ts         — Streaming AI advisor endpoint (POST)
  components/
    app-sidebar.tsx         — Sidebar nav + theme toggle
    overview/               — OverviewDashboard, ExpenseDonut
    expenses/               — ImportForm, AnalysisDashboard, CategoryBreakdownTable, PeriodSelector
    trends/                 — TrendsDashboard (Recharts)
    installments/           — InstallmentsDashboard, InstallmentForm, PayButton, MonthNav, AllInstallmentsTable
    loans/                  — LoansDashboard, AccountCard, DebtorForm, LoanForm, PaymentForm, EntryForm, AccountForm, TransferForm, LoansClient, LoanRowActions
    settings/               — CategoryList, MappingList
    chat/                   — FloatingChat, ChatProvider, ChatMessages, ChatInput
    ui/                     — shadcn/ui base-nova primitives
  lib/
    db.ts                   — Prisma client singleton
    format.ts               — formatCOP(), MONTH_NAMES
    utils.ts                — cn() (clsx + tailwind-merge)
    installment-utils.ts    — computeMonthlyAmount(), computeInstallmentDue(), rate converters
    parse-moneylover.ts     — XLSX → Transaction[] parser
    queries/
      expenses.ts           — getMonthlyAnalysis(), getImportBatches(), getUnmappedCategories()
      installments.ts       — getAllInstallments(), getMonthSummary()
      loans.ts              — getLoansOverview()
      trends.ts             — getTrends()
      health-score.ts       — getHealthScore()
      chat.ts               — getFinancialSnapshot()
    actions/
      import.ts             — importMoneyLoverFile(), importBuffer()
      drive.ts              — listDriveFiles(), importFromDrive()
      expenses.ts           — expense-related server actions
      categories.ts         — AppCategory + BudgetItem CRUD actions
      installments.ts       — Installment + InstallmentPayment CRUD actions
      loans.ts              — SavingsAccount, Debtor, Loan, LoanPayment, Transfer CRUD actions
      chat.ts               — saveMessage()
  generated/
    prisma/                 — Prisma-generated client (do not edit manually)
  hooks/
    use-mobile.ts           — Breakpoint hook for sidebar collapse
```

## Module breakdown

### `src/app/(app)/overview`
**Responsibility:** Home dashboard. Aggregates data from all three modules into a single-page health summary.
**Key files:** `overview/page.tsx` → `components/overview/overview-dashboard.tsx`, `components/overview/expense-donut.tsx`
**Dependencies:** `getMonthlyAnalysis`, `getMonthSummary`, `getLoansOverview`, `getHealthScore`
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
**Responsibility:** Tracks deferred purchases split into monthly payments. Shows a monthly obligation summary (total due, paid, remaining), lists all active and finished installments, and allows marking payments.
**Key files:** `installments/page.tsx`, `components/installments/installments-dashboard.tsx`, `installment-form.tsx`, `pay-button.tsx`, `month-nav.tsx`, `all-installments-table.tsx`
**Dependencies:** `getAllInstallments`, `getMonthSummary`, `computeInstallmentDue`
**Exports:** `InstallmentsPage` (route)

---

### `src/app/(app)/loans`
**Responsibility:** Tracks personal savings accounts and money lent to debtors. Shows account balances (computed from ledger), outstanding loans per debtor, KPIs (available, in loans, liquidity ratio), and allows full CRUD on accounts, debtors, loans, payments, and transfers.
**Key files:** `loans/page.tsx`, `components/loans/loans-dashboard.tsx`, `loans-client.tsx`, `account-card.tsx`, `debtor-form.tsx`, `loan-form.tsx`, `payment-form.tsx`, `entry-form.tsx`, `account-form.tsx`, `loan-row-actions.tsx`
**Dependencies:** `getLoansOverview`
**Exports:** `LoansPage` (route)

---

### `src/app/(app)/chat`
**Responsibility:** Full-screen AI advisor backed by Claude Haiku. Conversation history is persisted in the `ChatMessage` table. Each message injects a live financial snapshot as the system prompt.
**Key files:** `chat/page.tsx`, `components/chat/chat-provider.tsx`, `chat-messages.tsx`, `chat-input.tsx`, `floating-chat.tsx`, `src/app/api/chat/route.ts`
**Dependencies:** `getFinancialSnapshot`, `saveMessage`, Anthropic SDK (streaming)
**Exports:** `ChatPage` (route), `FloatingChat` (accessible from any page via the app layout)

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
- `installments.ts` — `getAllInstallments()`: status-enriched list; `getMonthSummary()`: obligations for a given month
- `loans.ts` — `getLoansOverview()`: accounts with computed balances, debtors with computed loan remainders, portfolio KPIs
- `trends.ts` — `getTrends(n)`: per-month income/expense/budget/savings-rate + per-category spend across n months
- `health-score.ts` — `getHealthScore()`: composite 0–100 score with month-over-month delta
- `chat.ts` — `getFinancialSnapshot()`: plain-text financial summary for the AI system prompt

---

### `src/lib/actions/`
**Responsibility:** All write operations exposed as Next.js Server Actions (or API route handlers for streaming). Call `revalidatePath` after mutations.
**Key files:**
- `import.ts` — `importMoneyLoverFile()` / `importBuffer()`: parse XLSX → upsert categories → replace batch → insert transactions
- `drive.ts` — `listDriveFiles()` / `importFromDrive()`: Google Drive service account integration
- `categories.ts` — AppCategory and BudgetItem create/update/delete
- `installments.ts` — Installment and InstallmentPayment create/update/delete/pay
- `loans.ts` — SavingsAccount, AccountEntry, Transfer, Debtor, Loan, LoanPayment CRUD
- `chat.ts` — `saveMessage()`: persist a single ChatMessage row

---

### `src/lib/installment-utils.ts`
**Responsibility:** Pure math for German amortization. Safe to import in any context (server, client, test).
**Key exports:**
- `computeMonthlyAmount(total, n)` — capital per payment (P/n)
- `computeInstallmentDue(total, n, k, rate?)` — total due for the kth payment with optional interest
- `eaToMonthly(ea)` / `monthlyToEA(monthly)` — interest rate conversions

---

### `src/lib/parse-moneylover.ts`
**Responsibility:** Parses a MoneyLover XLSX buffer into a structured `ParsedMoneyLover` object. Handles period boundary detection (configurable `FINANCIAL_MONTH_START_DAY` env var), discovers categories dynamically, and normalizes rows.
**Dependencies:** `xlsx` package
