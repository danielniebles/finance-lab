@AGENTS.md

# Finance Lab — Project Context

Personal finance tracking application for a single user. All amounts in COP (Colombian Peso).

## Stack

- **Framework**: Next.js 16 App Router + React 19 + TypeScript (read `node_modules/next/dist/docs/` before using an API — see AGENTS.md)
- **Database**: PostgreSQL (Docker locally) + Prisma ORM
- **UI**: shadcn/ui (base-nova style) + Tailwind CSS v4 + the app design system (`src/components/ds`, see "UI rules")
- **Charts**: Recharts 3
- **Tests**: Vitest (`npx vitest run`); lint gate: `npx eslint src` (complexity 12, cognitive 15, max 120 lines per function; grandfathered hits in `eslint-suppressions.json`)
- **Fonts**: Sora (headings) · DM Sans (body) · JetBrains Mono (numbers)
- **Theme**: four theme blocks — default/Signal × light/dark (`theme` cookie + `THEME_FAMILY` env). Dark by default.
- **Hosting**: Local (Docker Compose) + Vercel (frontend) + Supabase (PostgreSQL)

## shadcn/ui version notes

This project uses the **base-nova** style of shadcn which uses `@base-ui/react` internally instead of Radix. Key differences:
- Components use a `render` prop instead of `asChild` for composition
- `Select.onValueChange` receives `(value: string | null, eventDetails)` — always guard against null
- `SidebarMenuButton`, `SidebarGroupLabel`, `SidebarMenuSubButton` all use `render={<Link href="..." />}` pattern

## Prisma

- Generated client output: `src/generated/prisma/`
- Import `PrismaClient` from `@/generated/prisma/client`
- Import enums (e.g. `BudgetType`) from `@/generated/prisma` (not the `/enums` subpath — webpack can't resolve it through the generated package's exports map)
- After schema changes: `nvm use node && npx prisma migrate dev --name <name>`
- After generate-only: `nvm use node && npx prisma generate`
- Client singleton in `src/lib/db.ts`

## Environment

- Docker Compose starts Postgres: `docker compose up -d`
- DB connection: `postgresql://financelab:financelab@localhost:5432/financelab`
- All DB-querying pages must export `export const dynamic = "force-dynamic"`

## Architecture

```
src/
├── app/
│   ├── page.tsx                  # Redirects to /overview
│   ├── globals.css               # Theme tokens: :root, .dark, .signal, .dark.signal
│   └── (app)/                    # Sidebar shell
│       ├── overview/             # Home: balance, month snapshot, wallets, vaults, obligations, insights
│       ├── expenses/             # Ledger + Analysis views (?view=ledger|analysis)
│       ├── installments/         # Credit-card installments
│       ├── loans/                # Savings & Loans: net worth, accounts, debtors
│       ├── vaults/               # Sinking funds + recurring expenses
│       ├── trends/               # Health score, income vs spending, category trends
│       ├── chat/                 # Advisor (agent)
│       └── settings/             # categories, rules, tags, mappings (legacy), design-system (dev only)
├── components/
│   ├── ds/                       # Design system: PageHeader, Money, StatusChip, Meter, StatCard, SectionHeader, ListRow, ReadingGrid, ColorDot; ds/form: FormDialog, Field, MoneyInput, DateField, OptionSelect, SegmentedControl, TagInput, ColorPicker, CheckField
│   ├── ui/                       # shadcn primitives (don't restyle here)
│   └── <module>/                 # One folder per screen; big screens split into subfolders (overview/home, expenses/analysis, loans/debtors)
└── lib/
    ├── status.ts                 # Domain state → Tone → classes (TONE_CLASSES)
    ├── *-display.ts / *-utils.ts # Pure, tested display rules per module (vault-display, installment-display, loan-display, trend-utils, health-score-utils, category-status, home-insights …)
    ├── financial-period-utils.ts # financialMonthYear, getFinancialPeriodBounds
    ├── queries/                  # Server reads (Prisma)
    ├── actions/                  # Server Actions
    └── agent/, telegram/         # Advisor + Telegram capture
```

Decisions live in `docs/decisions.md` (ADRs); add one when a data rule changes.

## UI rules (design system)

Read `DESIGN.md` before building UI; §7 maps it to code. `/settings/design-system` (dev only) renders every token and component.

**Colours**
- Only theme tokens (`bg-card`, `text-muted-foreground`, `bg-meter-track`, `bg-chart-3` …). No raw palette classes (`text-red-500`, `bg-black/50`), hex, `rgb()` or `oklch()` in `src/components`, `src/app` or `src/lib`. `src/lib/design-system-guard.test.ts` fails on any hit, with file:line; its allowlist is only for colours that are user data or rendered outside the page.
- Status colours only through `src/lib/status.ts`: map the domain state to a `Tone` with a `toneFor…` helper, then use `StatusChip` / `Meter` / `Money tone` or `TONE_CLASSES[tone]`. Add a new `toneFor…` helper instead of picking classes in a component.
- Chart series use `chart-1…8`, never status colours.
- User-chosen colours (accounts, cards, wallets) render with `<ColorDot color={…}>`. Category hues come from `lib/category-style.ts`.
- New tokens go in **all four** theme blocks in `globals.css` (`theme-tokens.test.ts` enforces it).

**Components and patterns**
- Peso amounts: `<Money>` (use `compact` in tight spots). Privacy masking: `MASK` from `components/loans/lib/constants`.
- Rows of label + amount: `<ReadingGrid>`. It wraps instead of overflowing with long COP values.
- Cards: `rounded-2xl border border-border/60 bg-card p-5 sm:p-6`; the page's hero card adds `surface-glow`. Section labels: small uppercase `text-muted-foreground`.
- Lists are responsive grids (one markup, `sm:` columns), not a `<Table>` plus a separate mobile list.
- Forms and modals: `FormDialog` + `FormFooter`, every control inside a `Field`; amounts with `MoneyInput`, dates with `DateField` (values stay `YYYY-MM-DD`; parse with `parseISODate`, never `new Date("YYYY-MM-DD")`, which is UTC midnight), dropdowns with `OptionSelect`. DESIGN.md §7 "Forms".
- Keep display rules (sorting, labels, which chip to show) in a pure `lib/*-display.ts` with tests; components stay presentational.
- Server components can't call client-only helpers (e.g. `buttonVariants`); use plain classes on `Link`.

**Building or changing a screen**
1. Check DESIGN.md §7 and an already-migrated screen (Home, Expenses, Vaults, Installments, Loans, Trends).
2. Build from `components/ds` + tones; no new colour classes.
3. Check it at 1440px and 390px wide, light and dark, and with `THEME_FAMILY=signal`.
4. Run `npx tsc --noEmit`, `npx eslint src`, `npx vitest run`.

## Data model summary

**Module 1 — Expenses**
- `ImportBatch` — one per month/year; re-importing the same month replaces the batch
- `Transaction` — raw MoneyLover rows; positive = income, negative = expense
- `MoneyLoverCategory` — discovered dynamically from imports (never pre-seeded)
- `AppCategory` — user-defined simplified categories with FIXED/VARIABLE budget
- `CategoryMapping` — links MoneyLoverCategory → AppCategory (1:1)

**Module 2 — Installments**
- `Installment` — description, totalAmount, numInstallments, monthlyAmount, optional interest rate (German amortization)
- `InstallmentPayment` — records each paid slot

**Module 3 — Loans**
- `SavingsAccount`, `AccountEntry`, `Transfer`, `Debtor`, `Loan`, `LoanPayment`

## MoneyLover import format (deprecated)

Import is retired: transactions are logged directly in the app (manual entry, Advisor, Telegram). The parser, `import.ts` action and `import-form.tsx` are kept and marked `@deprecated` because historical imported data still lives in the DB; `/settings/mappings` ("Legacy mappings") stays so that history remains categorised. Do not build on it, and never derive "the current month" from `ImportBatch` — use `financialMonthYear(new Date(), startDay)`.

Historical format:

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
- **Category severity** — OK / Pending / Issue / Critical / Unplanned (Pending = fixed bill not paid yet while the month is open, ADR-048)

## Milestones

- [x] **Milestone 1** — Expense Tracker (import, category mapping, analysis dashboard)
- [x] **Milestone 2** — Installment Tracker (CRUD + month-end obligation summary)
- [x] **Milestone 3** — Loan/Debt Tracker (savings accounts, debtors, partial payments)
- [x] **Milestone 4** — Polish + deploy (Vercel + Supabase)
