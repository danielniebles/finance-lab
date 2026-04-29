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
