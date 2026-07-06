# Finance Lab Agent

> This file documents the agent's behavior for humans. The operative system prompt lives in `src/lib/agent/prompt.ts` (single source of truth). Tool schemas live in the `TOOLS` array in `src/lib/agent/tools.ts`; the tool-use loop is orchestrated by `src/lib/agent/run-agent-turn.ts` (split into `read-tools.ts`, `formatting.ts`, and `proposals/` — see `docs/modules.md`). Keep this doc descriptive, not authoritative.

---

## 1. Identity

*(canonical text: `src/lib/agent/prompt.ts`)*

The agent is a **personal financial operator** embedded in Finance Lab. It is not a
generic chatbot. It has live, structured access to one user's real finances (single
user, Colombia, all amounts in COP) and its job is to help that user *understand* and
*act on* their money across every module of the app.

It supersedes the original "static-snapshot advisor" (ADR-009). The difference:

- **Old advisor:** read a pre-baked text snapshot, could only talk about what was in it.
- **This agent:** calls tools on demand to read exactly the data a question needs, and
  can **draft concrete changes** to the user's data for the user to approve.

Language: respond in the language the user writes in (Spanish or English). Be concise
and direct. No generic disclaimers. Numbers always in COP, formatted with thousands
separators.

---

## 2. Core principle: propose, then confirm

**The agent never writes to the database on its own.** Every mutation is a *proposal*.

1. The agent gathers context with **read tools**.
2. When a change is warranted, it calls a **proposal tool**. A proposal tool does
   **not** mutate anything — it returns a structured, human-readable description of
   the intended action and surfaces it to the user as an **action card** in the chat.
3. The user reviews the card and clicks **Approve** or **Dismiss**. Approval — never the
   model — triggers the real, already-validated server action.

This means: a misbehaving or hallucinating model can, at worst, propose a bad action.
It can never silently move money, create debt, or delete records. The existing server
actions (which carry all validation) remain the only code path that writes.

The agent should:

- Always read before it proposes. Never propose a number it didn't derive from a tool.
- Propose **one coherent action per card** (e.g. "contribute 200,000 to Trip vault"),
  not a bundle the user can't partially reject.
- State its reasoning briefly *with* the proposal ("You're 200k behind pace on Trip and
  have a 1.1M surplus this month — here's a contribution to catch up.").
- Never claim an action is done. Say it's *drafted for your approval*.

---

## 2b. Channels

The agent core is channel-agnostic. `runAgentTurn()` knows nothing about React or Telegram — it emits neutral `ProposalDescriptor` objects and streams text via an `onTextDelta` callback. Two channels are currently wired:

- **Web:** the NDJSON stream in `/api/chat` serializes proposals as `{type:"proposal", proposalId, ...}`; `ActionCard` renders them; approval calls `POST /api/proposals/resolve`.
- **Telegram:** the webhook at `/api/telegram` calls `runAgentTurn()` (buffered, no streaming), sends text and proposal messages with inline keyboard buttons; button taps call `resolveProposal()` directly.

Propose-then-confirm (§2) is preserved on every channel — the user must tap Approve before any mutation occurs.

---

## 3. Module-context awareness

The chat bubble is openable from any screen. When the user opens it from inside a
module, the request carries a **context object** describing what they're looking at, so
"what's wrong with this month?" or "should I fund this?" resolve against the open view.

Context the client sends (all optional):

| Field | Example | Meaning |
|---|---|---|
| `route` | `/expenses` | The module the user is on |
| `module` | `expenses` | Normalized module name |
| `focus` | `{ month: 6, year: 2026 }` | The period/record in view |
| `entityId` | `vault_abc123` | A specific record the user has open |

The agent's system prompt is told: *"The user is currently viewing: \<module\> (\<focus\>)."*
When the user's message is deictic ("this", "here", "that one"), resolve it against the
context before asking a clarifying question. If context is absent, ask.

---

## 4. Tool catalog

Tools come in two classes. **Read tools** execute immediately and return data.
**Proposal tools** return an action card and never mutate.

### 4.1 Read tools (map to existing query functions)

| Tool | Maps to | Returns |
|---|---|---|
| `get_overview()` | `getFinancialSnapshot()` / `getHealthScore()` | High-level briefing across all modules |
| `get_available_months()` | `getImportBatches()` | Which months have imported expense data |
| `get_monthly_analysis(month, year)` | `getMonthlyAnalysis()` | Full budget/actual/severity breakdown for one month |
| `get_transactions(month, year, category?)` | raw Prisma on `Transaction` | Individual transactions, filterable |
| `get_trends(n)` | `getTrends(n)` | Multi-month income/expense/savings-rate patterns |
| `get_installments()` | `getAllInstallments()` | Active + finished installments, monthly obligation |
| `get_loans()` | `getLoansOverview()` | Savings accounts, debtors, liquidity KPIs |
| `get_vaults()` | `getVaults()` | All vaults with computed balance + progress. A RECURRING vault's `requiredThisMonth` reflects the sum of set-asides from its linked recurring expenses. |
| `get_vault_obligations(month, year)` | `getVaultObligations()` | Per-vault required / contributed / still-needed this month |
| `get_recurring_expenses(month, year)` | `getRecurringExpenses()` | All active recurring expenses with computed set-aside amounts and status |
| `get_forecast(month, year)` | `getForecast()` | Projected savings rate + per-category landing ranges from trend history (historical only). When an IN_PROGRESS batch exists for the month, returns pacing mode fields: `pacingMode`, `spentSoFar`, `projectedVariableSpend`, `daysElapsed`, `daysInMonth`. |
| `list_drive_files()` | `listDriveFiles()` | Lists MoneyLover XLSX files in the configured Google Drive folder, ordered by most-recently modified |

### 4.2 Proposal tools (return an action card; never mutate)

Authoritative mapping: `src/lib/agent/actions.ts`.

| Tool | Approve triggers | Notes |
|---|---|---|
| `propose_create_vault(name, kind, goalType, targetAmount?, targetDate?)` | `createVault()` | `targetAmount` + `targetDate` required when `goalType=FIXED_DEADLINE` |
| `propose_update_vault(vaultId, …fields)` | `updateVault()` | Rename, retarget, recolor, change kind |
| `propose_vault_contribution(vaultId, amount, date?, notes?, sourceAccountId?)` | `addVaultEntry()` (positive) | The flagship action behind "save X this month". Include `sourceAccountId` when the user says "move X from [account] into [vault]" — funds move from savings into the vault (real balance change). Omit for a notional earmark. |
| `propose_vault_withdrawal(vaultId, amount, date?, notes?, sourceAccountId?)` | `addVaultEntry()` (negative) | Spending from / raiding a vault. Include `sourceAccountId` when funds should return to a specific savings account. |
| `propose_archive_vault(vaultId)` | `archiveVault()` | Close a met or abandoned goal without deleting history |
| `propose_create_recurring_expense(name, estimatedAmount, cadenceMonths, nextDueDate, category?, fundingVaultId?)` | `createRecurringExpense()` | Register a new recurring bill in the calendar |
| `propose_pay_recurring(id, amount, fromVaultId?)` | `payRecurringExpense()` | Record a payment and roll the cycle forward; optionally withdraws from the linked sinking-fund vault |
| `propose_import_from_drive(fileId?, status?)` | `importFromDrive()` | Import a MoneyLover file from Drive. Auto-picks most recent if `fileId` omitted. `status` defaults to `IN_PROGRESS` for current month, `FINAL` for past months. |
| `propose_create_installment(description, totalAmount, numInstallments, startDate, monthlyInterestRate?, cardName?, fundingAccountName?)` | `createInstallment()` | Create a new installment with true-cost preview (capital, first cuota, total interest, total repaid). If `cardName` doesn't exist, a new `CreditCard` is created in the same proposal. |
| `propose_mark_installment_paid(installmentName, month?, year?)` | `markPayment()` | Mark the cuota due in the given month as paid. Resolves installment by name and slot by month. |
| `propose_create_loan(amount, debtorName, fundingAccountName, date?, expectedBy?, notes?)` | `createLoan()` | Create a loan record. If debtor doesn't exist, creates them in the proposal. Savings accounts must exist — ask user if not found. |
| `propose_record_loan_payment(debtorName, amount, date?, notes?)` | `recordLoanPayment()` | Record a repayment from a debtor. Targets oldest active loan when multiple exist. Shows resulting outstanding balance. |
| `propose_account_adjustment(accountName, amount, date?, notes?)` | `createEntry()` (type ADJUSTMENT) | Direct debit/credit/correction on a savings account — no repayment expected. Signed amount: negative = money out, positive = money in. Account must exist — ask user if not found. |
| `propose_transfer(fromAccountName, toAccountName, amount, date?, notes?)` | `createTransfer()` | Move money between two of the user's savings accounts. Both accounts must exist — ask user if either is not found. |
| `propose_undo_last()` | reverse of last approved action | Proposes reversal of the most recent approved conversational write. Reversible: createInstallment, markPayment, createLoan, recordPayment, createDebtor, createCard, accountAdjustment, transfer. Imports are NOT reversible. |

---

## 5. Domain rules: Vaults

A **vault** (a.k.a. pocket) is a standalone pot of earmarked money. It is **not** part of
the SavingsAccount / liquidity model — it has its own ledger and balance and does not
appear in the loans/liquidity KPIs. (See ADR-014, amended by ADR-021.)

**Sourced vs. notional contributions (ADR-021):** A vault entry may optionally name a
`sourceAccountId`. When it does, the contribution is **sourced** — the funds move out of
that savings account's computed `available` balance and into the vault. The account
balance drops; the vault balance rises. These sourced amounts are tracked in `inVaults`
(returned by `get_loans()`), a figure that is **separate from `totalSavings`**. The
conserved quantity is `netWorth = totalSavings + inVaults`. Without a `sourceAccountId`,
a contribution is **notional** — it earmarks money conceptually but does not touch any
savings account balance. Choose based on whether the user is actually moving real money.

**Kinds** (label that drives prioritization and tone, not behavior):
`MANDATORY` (must-fund — e.g. taxes, insurance) and `LEISURE` (wants — e.g. a trip).
Extend the enum as needed.

**Shapes:**

- **`FIXED_DEADLINE`** — has `targetAmount` and `targetDate`.
  - `remaining = max(0, targetAmount − balance)`
  - `monthsLeft = max(1, whole months from this month through targetDate)`
  - `requiredThisMonth = remaining / monthsLeft`
- **`OPEN_ENDED`** — no deadline, optional aspirational target. `requiredThisMonth = 0`;
  the agent may still *suggest* pacing but never reports a hard "behind".

**Shortfall = automatic re-spread (no money moves, no debt created).** Because
`requiredThisMonth` is always recomputed as `remaining / monthsLeft`, underfunding one
month organically raises next month's required amount. The agent's job on a shortfall is
to **warn and re-plan**, never to silently pull from savings or open an installment. (If
the user *explicitly* asks to raid savings to cover a vault, that's a normal withdrawal
on the source account plus a vault contribution — propose both as separate cards and say
so.)

**Status tiers** (for a given month, used by the agent and the banner):

| Status | Condition |
|---|---|
| `Met` | balance ≥ targetAmount |
| `On track` | contributedThisMonth ≥ requiredThisMonth |
| `Behind` | contributedThisMonth < requiredThisMonth, targetDate not past |
| `Overdue` | targetDate is past and balance < targetAmount |
| `—` (info only) | OPEN_ENDED |

**Suggestion banners feed deterministically from data, not from the agent.** The
"what you must save this month" banner is computed by `getVaultObligations()` and rendered
in the app. The agent *complements* it: from the banner the user can open the chat
pre-seeded with that vault's context and say "draft it," and the agent responds with a
`propose_vault_contribution` card. The banner is the alarm; the agent is the hands.

---

---

## 5b. Domain rules: Recurring Expenses + Sinking Funds

A **recurring expense** is a non-monthly cost the user knows is coming: taxes, oil change, car inspection, insurance. The key fields are `estimatedAmount`, `cadenceMonths`, and `nextDueDate`.

**Set-aside math:** `monthlySetAside = estimatedAmount / monthsUntilDue`. `monthsUntilDue` is always at least 1 — if the item is due this month, the full estimated amount is the set-aside. This is the re-spread principle: falling behind one month silently raises next month's requirement; no debt is created.

**Cycle roll:** On payment, `nextDueDate` advances by `cadenceMonths` via `rollCycle()`. The actual paid amount can differ from the estimate (user adjusts at pay time).

**Sinking-fund vault (goalType = RECURRING):** A vault that accumulates monthly set-asides for a basket of recurring expenses linked via `fundingVaultId`. Its `requiredThisMonth` is `sum(monthlySetAside(item))` over all active linked expenses. The agent should:
- Use `get_recurring_expenses` to see upcoming bills and set-asides.
- Use `get_vault_obligations` to see if the sinking fund is on pace (`On track`) or `Underfunded`.
- When the user mentions a bill they pay periodically, propose `propose_create_recurring_expense`.
- When the user says they paid a recurring bill, propose `propose_pay_recurring` — always read `get_recurring_expenses` first to get the correct `id` and suggest using the linked vault as `fromVaultId` if one exists.
- Quote the actual set-aside figure when answering "how much should I put in the Car fund this month?"

**Status tiers for recurring expenses:**
| Status | Condition |
|---|---|
| Funded | fundingVaultId set and vault balance ≥ estimatedAmount |
| DueSoon | nextDueDate falls within the current month |
| Overdue | nextDueDate is in the past |
| Underfunded | has a funding vault but vault balance < estimatedAmount, or no vault |

---

---

## 5c. Domain rules: Forecasting

The forecast is **historical-only** — it reads past import batches (last 6 months) and predicts where variable categories will land at month-end. It does **not** read current-month actuals (there are none until an import happens).

**Key rules:**

- **Ranges, not point certainties.** Each category produces a `{ expected, low, high, confidence }` band (±1 std dev). The agent should quote a range, not a single number, and say "projected" not "will be."
- **Quiet on thin data.** When `dataSufficiency === "thin"` (fewer than 3 months of history), the agent acknowledges the projection isn't reliable yet. It should NOT fabricate numbers or confidence.
- **Temper vault-funding advice when below target.** If `projectedSavingsRate` is below `savingsRateTarget` and `vsTarget < 0`, the agent should note the shortfall and suggest funding vaults lighter this month rather than pushing the user into further deficit.
- **Income fallback.** Phase B (`getIncomePlan`) is not yet shipped. `expectedIncome` is the trailing income average from `getTrends`. When income has been highly variable, the agent should acknowledge uncertainty on that dimension too.

---

---

## 5d. Domain rules: Conversational entry

Conversational entry covers the set of proposal tools that write to Installments and Loans. These tools interact with real money and structured records — follow these rules to keep proposals correct and honest.

**Read before you propose.** Always call `get_installments()` or `get_loans()` before any proposal in these domains. Name resolution (installment description → id, debtor name → id, card name → id) happens in the proposal tool itself, but you need the list to confirm names before calling.

**Name resolution order:**
1. Case-insensitive exact match first.
2. If no exact match, case-insensitive partial match (contains).
3. If still no match → `blockingMessage` is returned as an error; the tool loop surfaces it back to the model, which must ask the user to clarify.

**In-proposal entity creation rules:**
- `CreditCard` — may be auto-created in a `createInstallment` proposal if `cardName` doesn't exist. The proposal card labels it "⚠ new card will be created."
- `Debtor` — may be auto-created in a `createLoan` proposal if `debtorName` doesn't exist. Same label.
- `SavingsAccount` — NEVER auto-created. If `fundingAccountName` is not found, the tool returns a blocking message asking the user which account to use.

**True-cost preview for installments.** Every `propose_create_installment` card must show:
- Monthly capital (P/n)
- First cuota with interest (higher because early balance is larger)
- Total interest over the full term
- Total repaid (principal + interest)

This uses German amortization (`computeInstallmentDue` in `installment-utils.ts`). Never omit the cost preview.

**Resulting balance for loan payments.** Every `propose_record_loan_payment` card must show the current outstanding and the balance after this payment. When a debtor has multiple active loans, note which one is being targeted (oldest by creation date) and how many remain.

**Undo scope.** `propose_undo_last` only searches proposals with `status = "approved"` and `action` in the reversible set. Imports are never reversible (re-import the correct file instead). Undo itself is a proposal — the user must approve it. After a successful undo, the original proposal's status is set to `"undone"`.

**Telegram undo button.** After approving a reversible action via Telegram, the webhook automatically sends an "↩ Undo" inline button. Tapping it triggers `propose_undo_last` targeting that specific proposal.

---

## 5e. Domain rules: Savings-account adjustments vs. vaults, ask-XOR-propose (ADR-027)

**A savings account is not a vault.** `propose_account_adjustment` and `propose_transfer` operate on `SavingsAccount` balances (the loans/liquidity model). `propose_vault_*` tools operate on a vault's own ledger (§5) — a separate concept with its own balance that is never part of `totalSavings`. Never treat a savings account id as a vault id or vice versa.

**Gift / direct expense ≠ loan.** Money leaving an account with no repayment expected (a gift, a direct purchase, a balance correction) is `propose_account_adjustment` with a negative amount. `propose_create_loan` is reserved for money expected back from a named debtor — the presence of a debtor is what makes it a loan, not the act of money leaving an account.

**Savings accounts are never auto-created.** Same rule as §5d for `fundingAccountName`: if `accountName` / `fromAccountName` / `toAccountName` doesn't resolve against `get_loans()`, the tool returns a `blockingMessage` listing the real accounts — never invent or silently create one.

**Ask XOR propose — one turn is never both.** If any required field is missing or the request is ambiguous, the agent asks exactly ONE concise clarifying question and emits no proposal tool call that turn. Only once every field is known does it emit exactly one proposal, with no accompanying question. This was previously violated (a turn could both ask and propose, confusing the user) and is now an explicit `prompt.ts` rule.

**History threading.** Telegram (`route.ts`) and web (`chat/route.ts`) both persist a combined assistant-turn record — `[text, proposalSummary].filter(Boolean).join("\n\n")` — instead of only `result.text`. A turn whose sole output is a proposal (no text) still lands in `ChatMessage`, so the next turn's history shows what was already proposed instead of the model re-asking or drifting to a different tool.

---

## 6. Extensibility model

To add a capability later, in order:

1. **Read first.** If the agent needs new data, add a read tool that maps to a query
   function. Read tools are always safe to add.
2. **Proposal, never direct write.** A new mutating capability is a `propose_*` tool that
   returns an action card and maps, on approval, to an existing validated server action.
   If no server action exists yet, build it first (it must do its own validation).
3. **Register in three places:** the tool's JSON schema + executor in the route, the
   action-card renderer + approve handler in the chat UI, and this catalog (§4).
4. **Document domain rules** for the new area as a new §5-style section, and add an ADR if
   it touches a module boundary or an invariant (like derived balances).

Natural next expansions (not in v1): `propose_create_installment`, `propose_loan_payment`,
`propose_mark_installment_paid`, `propose_account_transfer`. Each is higher-stakes than a
vault entry — keep them behind the same propose-then-confirm gate.

---

## 7. Model & runtime

- **Model:** `claude-sonnet-4-6` (upgrade from Haiku — Sonnet is materially better at
  deciding when/what to call). Cost delta is negligible at personal volume.
- **System prompt:** minimal — role + current date + currency + current module context +
  a short statement of the propose-then-confirm contract. No baked-in snapshot.
- **Loop:** standard Anthropic tool-use cycle. The model emits `tool_use`; the route
  executes the tool (read tools hit the DB, proposal tools emit an action-card event and
  return "proposal surfaced, awaiting user approval"); the route feeds `tool_result` back
  and continues until `end_turn`.
- **History:** persisted in `ChatMessage`. (Known issue: hard-capped at last 20 messages —
  see backlog.)

---

## 8. Response style checklist

- Lead with the answer, then the reasoning.
- Quote real figures from tools; never estimate when a tool can tell you.
- One proposal per card; explain why before the card.
- Say "drafted for your approval," never "done."
- Match the user's language. COP with separators. No filler disclaimers.
