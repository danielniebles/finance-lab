@AGENTS.md

# Finance Lab — Project Context

Personal finance tracking application for a single user. All amounts in COP (Colombian Peso).

## Stack

- **Framework**: Next.js 15 App Router + TypeScript
- **Database**: PostgreSQL (Docker locally) + Prisma ORM
- **UI**: shadcn/ui (base-nova style) + Tailwind CSS v4
- **Fonts**: Sora (headings) · DM Sans (body) · JetBrains Mono (numbers)
- **Theme**: Dark by default (`dark` class on `<html>`)
- **Hosting**: Local (Docker Compose) → Railway (future)

## shadcn/ui version notes

This project uses the **base-nova** style of shadcn which uses `@base-ui/react` internally instead of Radix. Key differences:
- Components use a `render` prop instead of `asChild` for composition
- `Select.onValueChange` receives `(value: string | null, eventDetails)` — always guard against null
- `SidebarMenuButton`, `SidebarGroupLabel`, `SidebarMenuSubButton` all use `render={<Link href="..." />}` pattern

## Prisma

- Generated client output: `src/generated/prisma/`
- Import `PrismaClient` from `@/generated/prisma/client`
- Import enums (e.g. `BudgetType`) from `@/generated/prisma/enums`
- After schema changes: `nvm use node && npx prisma migrate dev --name <name>`
- After generate-only: `nvm use node && npx prisma generate`
- Client singleton in `src/lib/db.ts`

## Environment

- Always run `nvm use node` before any `node`, `npm`, or `npx` command
- Docker Compose starts Postgres: `docker compose up -d`
- DB connection: `postgresql://financelab:financelab@localhost:5432/financelab`
- All DB-querying pages must export `export const dynamic = "force-dynamic"`

## Architecture

```
src/
├── app/
│   ├── layout.tsx              # Root layout — fonts + dark class
│   ├── page.tsx                # Redirects to /expenses
│   └── (app)/
│       ├── layout.tsx          # Sidebar shell (SidebarProvider + SidebarInset)
│       ├── expenses/page.tsx   # Monthly dashboard (import + analysis)
│       ├── installments/page.tsx  # Stub — Milestone 2
│       ├── loans/page.tsx         # Stub — Milestone 3
│       └── settings/
│           ├── categories/page.tsx   # AppCategory CRUD
│           └── mappings/page.tsx     # MoneyLover → AppCategory mappings
├── components/
│   ├── app-sidebar.tsx
│   ├── expenses/
│   │   ├── import-form.tsx       # XLSX upload (client component)
│   │   ├── analysis-dashboard.tsx # Server component — full monthly analysis
│   │   └── period-selector.tsx   # Month/year picker (client, router.push)
│   └── settings/
│       ├── category-list.tsx     # CRUD UI for AppCategory
│       └── mapping-list.tsx      # Map MoneyLover categories to AppCategory
└── lib/
    ├── db.ts                     # Prisma singleton
    ├── format.ts                 # formatCOP(), MONTH_NAMES
    ├── parse-moneylover.ts       # XLSX parser for MoneyLover exports
    ├── actions/
    │   ├── import.ts             # importMoneyLoverFile() server action
    │   └── categories.ts         # Category + mapping CRUD server actions
    └── queries/
        └── expenses.ts           # getMonthlyAnalysis(), getImportBatches()
```

## Data model summary

**Module 1 — Expenses**
- `ImportBatch` — one per month/year; re-importing the same month replaces the batch
- `Transaction` — raw MoneyLover rows; positive = income, negative = expense
- `MoneyLoverCategory` — discovered dynamically from imports (never pre-seeded)
- `AppCategory` — user-defined simplified categories with FIXED/VARIABLE budget
- `CategoryMapping` — links MoneyLoverCategory → AppCategory (1:1)

**Module 2 — Installments** (schema only, UI pending)
- `Installment` — description, totalAmount, numInstallments, installmentsPaid, monthlyAmount

**Module 3 — Loans** (schema only, UI pending)
- `SavingsAccount`, `Debtor`, `Loan`, `LoanPayment`

## MoneyLover import format

XLSX file, sheet name "Transactions". Columns: `Id, Date, Category, Amount, Currency, Wallet, Note, With, Event, Members`.
- Negative amount = expense, positive = income (Salary)
- `With`, `Event`, `Members` are always empty in practice
- "Credit Cards" category = credit card payment (treated as expense)
- No ignored categories — all rows including Salary are stored

## Expense analysis KPIs

The `getMonthlyAnalysis()` query returns:
- **Top offenders** — top 3 non-OK categories, sorted Critical → Unplanned → Issue then by overspend
- **Savings Rate** — `realSavings / totalIncome * 100` (target ≥ 20%)
- **Fixed/Variable subtotals** — actual, budget, control for each group
- **Variable Burn Rate** — `variableActual / variableBudget * 100` (alert if > 100%)
- **Savings** — Real (Salary − Actual), Ideal (Salary − Budget), Gap, Unplanned spend
- **Category severity** — OK / Issue / Critical / Unplanned with progress bars in table

## Milestones

- [x] **Milestone 1** — Expense Tracker (import, category mapping, analysis dashboard)
- [ ] **Milestone 2** — Installment Tracker (CRUD + month-end obligation summary)
- [ ] **Milestone 3** — Loan/Debt Tracker (savings accounts, debtors, partial payments)
- [ ] **Milestone 4** — Polish + Railway deploy
