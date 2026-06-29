# Backlog

## Known issues
- `next-themes` is listed as a dependency (`package.json`) but is not used — theme is managed via a plain cookie mechanism instead. The package can be removed.
- `@anthropic-ai/sdk` and the `@googleapis/drive` packages are production dependencies, which means they are bundled for the server but not tree-shaken. This is acceptable for a server-rendered app but worth noting if bundle size ever matters.
- The chat history window is hard-coded to the last 20 messages (`src/app/api/chat/route.ts:26`). Very long conversations silently drop older context.

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

### AI Advisor — upgrade to tool use (high value, medium effort)

**Problem:** The current advisor calls `getFinancialSnapshot()` on every message and injects a static plain-text report (last 3 months of expenses + loans + installments) as the system prompt. Claude can only reason over what's in that pre-baked blob — it can't drill into individual transactions, query months outside the 3-month window, or ask for more granular data. Every message also pays the full ~2000-token system prompt cost regardless of how simple the question is.

**Proposed solution:** Replace the static snapshot with Anthropic tool use. The system prompt becomes minimal (role + current date + currency). Claude calls tools on demand, fetching only the data the question requires.

**Tools to define** (map directly to existing query functions):

| Tool name | Maps to | What it unlocks |
|---|---|---|
| `get_available_months()` | `getImportBatches()` | Claude knows what data exists before asking |
| `get_monthly_analysis(month, year)` | `getMonthlyAnalysis()` in `queries/expenses.ts` | Full category breakdown for any month, not just last 3 |
| `get_transactions(month, year, category?)` | raw Prisma query on `Transaction` | Individual transactions, searchable by note/category |
| `get_trends(n)` | `getTrends()` in `queries/trends.ts` | Multi-month patterns |
| `get_installments()` | `getAllInstallments()` in `queries/installments.ts` | Full installment state |
| `get_loans()` | `getLoansOverview()` in `queries/loans.ts` | Savings + loans |
| `get_overview()` | `getFinancialSnapshot()` in `queries/chat.ts` | High-level briefing (optional, Claude calls when needed) |

**Primary file to change:** `src/app/api/chat/route.ts`

Current streaming loop (simple):
```ts
for await (const chunk of stream) {
  if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
    fullResponse += chunk.delta.text;
    controller.enqueue(encoder.encode(chunk.delta.text));
  }
}
```

New loop must handle the tool-use cycle — Claude emits a `tool_use` block, execution pauses, server runs the tool, injects a `tool_result` message, stream resumes:
```ts
// pseudo-code
while (true) {
  const response = await anthropic.messages.create({ tools, messages, ... });
  if (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(b => b.type === "tool_use");
    const toolResults = await Promise.all(toolUseBlocks.map(executeTool));
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults }); // tool_result blocks
    // continue loop
  } else {
    // stop_reason === "end_turn" — stream the text content to client
    break;
  }
}
```

**Streaming concern:** Tool execution interrupts the text stream. The client sees a brief pause while a tool runs (typically a Prisma query, ~10–50ms). This is acceptable for a chat UI but requires switching from `anthropic.messages.stream()` to `anthropic.messages.create()` for the tool-use turns, then streaming only the final text response. Alternatively, use streaming throughout and handle `content_block_start` events with `type: "tool_use"`.

**Model consideration:** Switch from `claude-haiku-4-5-20251001` to Sonnet for this feature. Haiku supports tool use but Sonnet is significantly better at deciding when and what to call. Cost delta is negligible for a personal app with low message volume.

**Prompt caching note:** Once tool use is in place, the minimal system prompt is cheap and stable — prompt caching becomes less critical than it is today. But if the `get_overview()` tool result is large and called frequently, caching its output at the tool-result level could help.

---

- **Prompt caching:** The AI advisor sends a fresh `getFinancialSnapshot()` string as the system prompt on every message. Since the snapshot is identical within a session, adding `cache_control: { type: "ephemeral" }` on the system prompt block would reduce Claude API costs by up to 90% for the repeated prefix.
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
