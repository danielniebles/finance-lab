# Changelog

Notable changes to Finance Lab, newest first, grouped by commit date. Backfilled
from full git history on 2026-07-22 (138 commits, `a465ed3`..`676c2d7`). Each
entry links back to its commit hash for the full diff.

Going forward, add a dated entry here as part of any `/commit` that ships a
user-facing change (new feature, fix, redesign) — skip pure internal
refactors/chores unless they're worth remembering.

## 2026-07-22
- Collapse loans account-card actions into overflow menu (`676c2d7`)
- Document redesign/Signal-theme changes + vault wallet-funding feature (`b5da5da`)

## 2026-07-21
- Add opt-in Signal theme alongside the default light/dark theme (`46c67c5`)
- Redesign expenses dashboard and ledger filters per handoff mocks (`3b773c1`)
- Redesign loans debtors and installments module per handoff mocks (`b1c6d7e`)

## 2026-07-17
- Fix phantom auto-record claims, switch bot output to English (`3eef8df`)
- Fix credit card carousel ring clipping and scroll snap (`514c16b`)
- Fix ledger edit date shift and empty bot transaction notes (`5b5a6ad`)
- Give counterparty rules a real wallet selector, backfill production (`14d747d`)

## 2026-07-16
- Fix stale wallet labels, free-text wallet input, and dialog scroll (`4de013f`)

## 2026-07-15
- Fix vault card overflow, ring clipping, and blank transaction notes (`9a403ee`)
- Document category icons, expenses nav fixes, wallet/PWA/agent changes (`e414f37`)
- Fund vault contributions from a specific wallet + category (`9d1515e`)
- Fix vault/recurring-expense month math and wire in financial-month (`54c68ea`)
- Condense mobile tables and add carousels across modules (`a2d8834`)
- Fix expenses toolbar and period selector on mobile (`307641a`)
- Redesign mobile bottom nav as floating glass pill (`787bd62`)

## 2026-07-13
- Guard against phantom "drafted for approval" replies with no real proposal (`d2f6c2d`)
- Add iOS home-screen app support (standalone mode, icon, manifest) (`6768c35`)
- Fall back to Bancolombia's default wallet on unresolved labels (`7a0e4d9`)
- Redesign Overview page hierarchy; add ledger balance summary (`6351c05`)
- Make installments, loans, and categories rows click-to-edit (`ae1959d`)
- Add per-account toggle for Overview total balance (`5412b0d`)
- Fix ledger/settings layout issues, sidebar icon size, add 8 category icons (`43ba22a`)

## 2026-07-11
- Redesign expense analysis cards, ledger row, and bump icon sizes app-wide (`2476684`)
- Add category icon/color picker; fix expenses ledger/analysis nav (`5fb6fd2`)
- Rework expense editing and navigation for mobile (`78561cc`)

## 2026-07-10
- Add category icons and colored pills to transaction ledger rows (`52fd3eb`)
- Scope ledger totals to wallet filter, add manual entry (`5b7240d`)
- Load .env.local for Prisma CLI and ignore .serena/ (`4267954`)
- Document the Wallet model and retire the old wallets backlog note (`f34c53d`)
- Show per-wallet balances and a grand total on Overview (`f557192`)
- Filter the transaction ledger by walletId instead of a label (`8a697c1`)
- Resolve walletId on every transaction/loan/vault write path (`d4d28a8`)
- Compute per-wallet balances via the opening-balance epoch (`a82c5d3`)
- Add Wallet model with C1 migration and Debit Card backfill (`e69523a`)

## 2026-07-09
- Fix app container looping on DB connection failure (`b5389ad`)
- Add transaction ledger UI with grouping and inline editing (`d9c23f8`)

## 2026-07-07
- Stop tracking .claude/settings.local.json (`8cfd8db`)
- Add credit-card screenshot batch ingestion (ADR-034) (`70e5335`)
- Add counterparty rules: auto-categorize + wallet routing (Phase 2) (`450aa2c`)

## 2026-07-06
- Add transactions milestone: bot-captured expenses + editable cards (`7b0ddb9`)
- Add /api/ingest endpoint for external text ingress (`5bde27f`)
- Fix agent conversation flow; add savings-account tools (`7ac6505`)
- Split agent god-file into modules; add tests; enforce Tailwind values (`4921531`)

## 2026-07-04
- **Refactor:** Clear all quality-gate violations in run-agent-turn.ts (`35f2e1c`)

## 2026-07-03
- **Fixed:** Switch to HTML parse mode; fix stale REVERSIBLE_ACTIONS (`c2b8c3f`)
- **Fixed:** Introduce Action Registry; fix all proposal approval dispatch (`e88247f`)
- **Refactor:** Clear remaining quality gate slots in payment-form and debtors-section (`8c76e41`)
- **Refactor:** Extract AccountEntryLog and KpiStrip/usePrivacyMode (`cf7a6cc`)
- Merge branch 'feature/vaults-and-agent' (`fcb2472`)
- **Chore:** Adopt quality gate and testing toolchain (`7197883`)
- **Refactor:** Org cleanup, useActionState migration, useLoanForm fix (`b48de2e`)

## 2026-07-01
- **Refactor:** Extract system prompt into prompt.ts (no behavior change) (`fc24a2b`)
- **Added:** Conversational entry + live current month milestone (`1d58500`)

## 2026-06-30
- Merge pull request #1 from danielniebles/feature/vaults-and-agent (`fde02d8`)
- Add multi-channel agent core and Telegram bot (`f52bc54`)
- Fix chat agent loop bug, add Markdown tables, constrain chat width (`97f5286`)
- **Added:** Phase C historical forecasting (`c58ed95`)
- **Added:** Allow vault contributions sourced from savings accounts (`fda4e5e`)

## 2026-06-29
- **Added:** Recurring expenses and sinking-fund vaults (`47301e7`)
- **Docs:** Update for Vaults module and Agent upgrade (`34e3805`)
- **Added:** Vaults module and upgrade AI advisor to tool use (`5f24e57`)
- **Fixed:** Import enums from main index, not /enums subpath (`da7c72e`)
- **Fixed:** Run prisma generate before next build on Vercel (`5ea1f3d`)

## 2026-06-26
- **Fixed:** Add directUrl to prisma.config.ts for migration support (`bdd50c8`)
- **Fixed:** Prevent card selection ring from being clipped (`992ae18`)
- **Added:** Redesign dashboard with handoff-inspired layout (`02ea096`)

## 2026-06-10
- **Chore:** Add .handoff/ to .gitignore (`e9a67d0`)
- **Added:** PRODUCT.md and DESIGN.md design context (`edb67df`)
- **Added:** Unified dashboard layout with per-card filter (`4d2f453`)
- **Added:** Credit card management with installment-loan bridge (`f47b6dc`)
- **Added:** CreditCard model and installment cross-module links (`b9e3767`)
- **Fixed:** Correct import paths to custom generated output (ADR-002) (`ab6ba3a`)

## 2026-04-29
- **Added:** Privacy mode to mask sensitive amounts (`43d28e2`)
- **Docs:** Add project docs and update milestone status (`91fc867`)

## 2026-04-26
- **Fixed:** Resolve all ESLint errors and warnings (`df52647`)

## 2026-04-25
- **Added:** New home dashboard with expense donut, installments and loans snapshot (`a2b068d`)
- **Added:** Overhaul charts, category table, health delta, period toggle (`5e10d32`)
- **Fixed:** Liquid balance as headline, always-visible actions pinned to bottom (`db5123b`)
- **Added:** Portfolio stats, debtor sort, age warning, bulk-clear, account totals (`37d83c7`)
- **Fixed:** Period selector navigation locked when current month has no data (`20ba362`)
- **Chore:** Use es-CO locale for all date formatting across the app (`70db4fa`)
- **Added:** Replace next-themes with cookie-based dark/light toggle (`84e0ed0`)
- **Added:** German amortization (cuota decreciente) + monthly rate input (`f347149`)
- **Added:** Interest rate, row selection, finished toggle, and double-fetch fix (`9d3ab4b`)

## 2026-04-24
- **Added:** Improve categories page usability (`317f499`)
- **Refactor:** Redesign category classification logic (`08bdc80`)
- **Fixed:** Improve budget breakdown and savings card clarity (`b3cead4`)
- **Fixed:** Migrate tables to ui/table component and fix column alignment (`8d0238e`)

## 2026-04-22
- **Added:** Period navigation jumps between imported months only (`8d8d900`)
- **Added:** Drive import UI with tab toggle in ImportForm (`90f68e3`)
- **Added:** Google Drive import backend (`03ce574`)
- **Fixed:** Suppress Base UI nativeButton warning in FloatingChat (`048b387`)

## 2026-04-21
- **Fixed:** Remove invalid double-dash from SVG XML comment (`4e2823a`)
- **Chore:** Remove default Vercel favicon.ico (`8d5bd86`)
- **Added:** SVG favicon with trend line icon (`d4170db`)
- **Added:** Financial health score, semantic color tokens, and mobile table fixes (`da16190`)

## 2026-04-16
- **Fixed:** Switch loan payment allocation from FIFO to LIFO (`0300f96`)

## 2026-04-03
- **Fixed:** Switch to prisma-client-js provider — outputs to node_modules by default (`0742283`)
- **Fixed:** Use default Prisma output path so Vercel bundles engine correctly (`5312dd1`)
- **Fixed:** Include Prisma engine binary in Vercel deployment bundle (`da5425a`)
- **Fixed:** Recharts tooltip formatter type error for Vercel build (`e72f13a`)
- **Chore:** Remove migrate from build — run migrations manually (`2d32aa9`)

## 2026-04-02
- **Chore:** Add directUrl for Supabase migrations via connection pooler (`24fb4b6`)
- **Chore:** Vercel deploy setup — postinstall, migrate on build, binary target (`79b1d14`)
- **Added:** Dark/light mode toggle + light mode color fixes + installments sort (`05487af`)
- **Added:** Trends module — income/expenses bar chart, savings rate line chart, category table (`d522401`)

## 2026-04-01
- **Added:** Expenses header matches installments layout, import in dialog (`9fd841c`)
- **Added:** Category transaction drill-down dialog + surplus/deficit category names (`81ecb90`)
- **Added:** Categories grid layout, hot reload fix, mapping page fixes (`e815769`)

## 2026-03-31
- **Added:** Markdown in chat, Docker fixes, db backup scripts (`839ba0f`)
- **Added:** Dockerize app + mapping page fixes (`88a1f3e`)

## 2026-03-30
- **Added:** AI advisor Phase 4 + financial month start day (`260250e`)
- **Added:** AI advisor scaffold — phases 1-3 (no tokens yet) (`9e34633`)

## 2026-03-25
- **Added:** Loans UX iteration — account filter, loansOut, entry log dialog (`1791395`)

## 2026-03-24
- **Added:** Loan edit/delete, debtor/entry forms, full-width loan table (`2f39313`)
- **Added:** Savings & loan tracker (Milestone 3) (`ef1b076`)

## 2026-03-23
- **Fixed:** Show category name in mapping select trigger (`d011741`)
- **Added:** Budget line items per category (bottom-up budgeting) (`17d931f`)
- **Added:** Installment tracker (Milestone 2) (`4615719`)
- **Fixed:** Font loading and add prisma migrations (`693ee92`)
- **Added:** Surplus/deficit variance and offset coverage metrics (`2a7801a`)
- **Docs:** Update CLAUDE.md with full project context (`2855fba`)
- **Added:** Savings rate, top offenders, and progress bars to dashboard (`9fad7c1`)
- **Added:** Redesign UI — dark theme, typography, and KPI pills (`53753af`)
- **Added:** Enrich expense analysis to match Excel KPI layout (`d68c217`)

## 2026-03-22
- **Added:** Stub installments and loans pages (Milestone 2 & 3) (`e0b2bb3`)
- **Added:** Settings pages for categories and mappings (`96990e7`)
- **Added:** Expenses module with import and analysis dashboard (`4c17a48`)
- **Added:** App shell with sidebar navigation (`27c7b10`)
- **Added:** Shadcn/ui components and hooks (`18b3d24`)
- **Added:** Server actions and queries for expenses and categories (`9b297c9`)
- **Added:** Prisma client singleton, COP formatter, and MoneyLover parser (`edbdad3`)
- **Added:** Define Prisma schema for all three modules (`2cf120c`)
- **Chore:** Add Docker Compose and configure project dependencies (`5bf9107`)
- **Added:** Initial commit (`d78114a`)
- Initial commit from Create Next App (`a465ed3`)
