# Data Model

> Last updated: 2026-07-21

## Entities

### ImportBatch
One import run covering a single calendar month. Uniquely keyed on `(month, year)` — re-importing replaces the batch.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| filename | String | Original XLSX filename |
| importedAt | DateTime | When the import ran |
| periodStart | DateTime | First day of the period |
| periodEnd | DateTime | Last day of the period |
| month | Int | 1–12 |
| year | Int | e.g. 2025 |
| status | BatchStatus enum | `FINAL` (default) or `IN_PROGRESS` — mid-month partial import. `IN_PROGRESS` batches are excluded from trend/forecast history and Health Score baselines but are included in current-month analysis (see ADR-024). |

**Enum `BatchStatus`:** `IN_PROGRESS` | `FINAL`

**Relations:** has many `Transaction`

---

### MoneyLoverCategory
Raw category names discovered from MoneyLover XLSX exports. Created on first import; never pre-seeded.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| name | String (unique) | e.g. "Food & Dining" |

**Relations:** has one optional `CategoryMapping`; has many `Transaction`

---

### AppCategory
User-defined budget category. Groups one or more MoneyLover categories and carries budget definitions.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| name | String (unique) | e.g. "Groceries" |
| icon | String? | Closed-registry key (`CATEGORY_ICON_KEYS`, `src/lib/category-keys.ts`) — null = auto-derive from name via `getCategoryStyle()`; non-null = explicit override (ADR-038) |
| color | String? | Closed-registry key (`CATEGORY_COLOR_KEYS`) — same null/override rule as `icon` (ADR-038) |

**Relations:** has many `CategoryMapping`; has many `BudgetItem`; has many `Transaction` (direct link — MANUAL rows only; see ADR-030); has many `CounterpartyRule` (via `counterpartyRules`, ADR-032)

---

### BudgetItem
A single budget line within an AppCategory. Multiple items per category allow mixed FIXED + VARIABLE budgets.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| appCategoryId | String | FK → AppCategory |
| name | String | Line item label |
| amount | Float | Monthly budget amount (COP) |
| budgetType | BudgetType enum | FIXED or VARIABLE |

---

### CategoryMapping
Links one MoneyLoverCategory to one AppCategory (1:1 on the MoneyLover side).

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| moneyLoverCategoryId | String (unique) | FK → MoneyLoverCategory |
| appCategoryId | String | FK → AppCategory |

---

### Transaction
A single expense/income record — either a row from a MoneyLover XLSX export (`source = MONEYLOVER`) or a bot/manually-captured entry (`source = MANUAL`, ADR-030). Positive amount = income; negative = expense.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| externalId | Int? | MoneyLover's own row ID — null for MANUAL |
| date | DateTime | Transaction date |
| amount | Float | Positive = income, negative = expense (COP) |
| wallet | String | LEGACY account/wallet label — MoneyLover wallet name, or a free-text label for MANUAL rows (e.g. bank name from a notification). Kept as a fallback + audit trail alongside `walletId` (ADR-036/037) — not dropped in C1. |
| note | String? | Optional note |
| batchId | String? | FK → ImportBatch (cascade delete) — null for MANUAL (not part of any import) |
| moneyLoverCategoryId | String? | FK → MoneyLoverCategory — null for MANUAL |
| appCategoryId | String? | FK → AppCategory — direct category link, set for MANUAL rows, null for MONEYLOVER rows (which resolve via `moneyLoverCategory.mapping` instead) |
| source | TransactionSource enum | `MONEYLOVER` (default) or `MANUAL` |
| walletId | String? | FK → Wallet (ADR-036/037) — the envelope partition this transaction belongs to. Nullable (backfilled by migration where the legacy `wallet` label resolves; null = unassigned). Resolved on every write path via `resolveWalletId()`/`buildWalletResolver()` (`src/lib/resolve-wallet.ts`), never set directly by a caller. |

**Category resolution rule (used everywhere a transaction's effective AppCategory is needed):** `appCategoryId ?? moneyLoverCategory?.mapping?.appCategoryId` (ADR-030).

**Enum `TransactionSource`:** `MONEYLOVER` | `MANUAL`

**Wallet resolution rule (ADR-036/037, amended ADR-040 — applied on every write):** given the row's `wallet`
string label, match a `Wallet` by name (case-insensitive) first; if that misses — including when the label
just names an institution with multiple partitions (e.g. "Bancolombia") — fall back to that
`SavingsAccount`'s `defaultWalletId`. If the label matches **neither** a wallet nor any account at all (a
bot guess like "Debit" that isn't a real name), fall back further to Bancolombia's `defaultWalletId`
specifically (ADR-040) — `walletId` is left null only if even that doesn't exist. See `src/lib/resolve-wallet.ts`.

---

### CounterpartyRule
A dictionary entry mapping a known counterparty (destination account, merchant, or sender) to a category and a wallet. Data model + CRUD layer shipped in Phase 2 of the transactions milestone (ADR-032); ingestion rule-matching, auto-record-and-notify, and learning shipped in the same phase's follow-on pass (ADR-033).

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| matchType | RuleMatchType enum | What kind of value `matchValue` holds |
| matchValue | String | Normalized on write via `normalizeMatchValue()` — digits-only for ACCOUNT, trimmed+uppercased for MERCHANT/SENDER/KEYWORD |
| direction | RuleDirection enum | Restricts the rule to EXPENSE, INCOME, or ANY (default) |
| appCategoryId | String | FK → AppCategory — category to route a match to |
| wallet | String | Wallet LABEL to route to — overrides the message's stated account. Plain string, like `Transaction.wallet` — no first-class Wallet model (deferred) |
| autoRecord | Boolean | Default true — matched → record automatically instead of proposing a card (ADR-033) |
| recurring | Boolean | Default false — hint: recurring inflow/outflow (foundation for Phase 3) |
| expectedAmount | Float? | Optional, for future recurring-cadence validation (Phase 3) |
| notes | String? | Optional notes |
| matchCount | Int | Default 0 — bumped by `bumpCounterpartyRuleMatch()` only when a match is actually used to auto-record (ADR-033) |
| lastMatchedAt | DateTime? | Set alongside `matchCount` |
| createdAt | DateTime | Record creation time |

**Enum `RuleMatchType`:** `ACCOUNT` | `MERCHANT` | `SENDER` | `KEYWORD`
**Enum `RuleDirection`:** `EXPENSE` | `INCOME` | `ANY`

**Relations:** belongs to `AppCategory`

**Normalization:** `normalizeMatchValue(matchType, raw)` in `src/lib/normalize-match-value.ts` — the single source of truth for turning a raw matched value into its stored/lookup form. Standalone file (not inside `actions/` or `queries/`) because it is shared by the CRUD write path and by `matchCounterpartyRule()`'s lookup path (ADR-033) — both must normalize identically or matching silently breaks.

**Matching (ADR-033):** `matchCounterpartyRule({ account?, merchant?, sender?, direction })` in `src/lib/queries/counterparty-rules.ts` tries `ACCOUNT` → `MERCHANT` → `SENDER` in that priority order (a single bundle call, not one lookup per matchType), filtering on `direction` (`ANY` matches either `EXPENSE` or `INCOME`). It is a pure read — it does not bump `matchCount`/`lastMatchedAt` itself; that is `bumpCounterpartyRuleMatch(ruleId)`, called only by the auto-record path once a match is actually used (a match that turns out low-confidence or `autoRecord: false` should not count as a real match).

---

### CreditCard
A bank credit card belonging to the user. Lives in the Installments module — not the Loans module (see concepts.md for the module boundary). Tracks outstanding debt and monthly obligations across linked installments.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| name | String (unique) | e.g. "Nu", "Rappi", "Falabella" |
| creditLimit | Float? | Optional credit limit (COP) |
| billingClosingDay | Int? | Day of month the billing cycle closes (e.g. 28) |
| paymentDueDay | Int? | Day of month payment is due (e.g. 10) |
| color | String? | Hex color for UI tile |

**Relations:** has many `Installment`

---

### Installment
A deferred purchase split across N monthly payments using German (cuota decreciente) amortization.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| description | String | e.g. "iPhone 15" |
| totalAmount | Float | Full purchase price (COP) |
| numInstallments | Int | Total number of payments |
| monthlyAmount | Float | Capital per payment = totalAmount / numInstallments |
| monthlyInterestRate | Float? | % m.v.; null = no interest |
| startDate | DateTime | Date of first payment |
| notes | String? | Optional notes |
| createdAt | DateTime | Record creation time |
| cardId | String? | FK → CreditCard (optional — which card was used) |
| debtorId | String? | FK → Debtor (optional — who this was bought for) |
| fundingAccountId | String? | FK → SavingsAccount via "InstallmentFunding" relation (only meaningful when debtorId is set — the savings account that disbursed cash for each cuota) |

**Relations:** has many `InstallmentPayment`; belongs to optional `CreditCard`; belongs to optional `Debtor`; belongs to optional `SavingsAccount` (funding)

---

### InstallmentPayment
Records one payment made for a specific installment slot.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| installmentId | String | FK → Installment (cascade delete) |
| installmentNum | Int | 1-based slot number |
| paidAt | DateTime | When it was paid |

---

### SavingsAccount
A personal savings or investment account — the **institution** (Bancolombia, Nu, Rappi, Protección). Since
ADR-036, this is the top level of a two-level **Account → Wallet** hierarchy: the account no longer holds a
balance flag directly — `includeInAvailable` moved down to `Wallet` (an account with one partition still
behaves exactly as before; a split account like Bancolombia now has per-partition flags). Balance is Σ its
wallets' computed balances (see `Wallet` below).

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| name | String (unique) | Account label |
| accountType | AccountType enum | BANK, DIGITAL, or PENSION |
| color | String? | Hex color for UI |
| savingsWalletId | String? | FK → Wallet — target wallet for account-level loan/vault-funding/transfer/adjustment flows (ADR-036/037). For a single-wallet account, equals `defaultWalletId`. |
| defaultWalletId | String? | FK → Wallet — default wallet for ambient transactions whose label only names the institution (e.g. a MoneyLover "Bancolombia" row). For a single-wallet account, equals `savingsWalletId`. |

**Relations:** has many `AccountEntry`; has many `Loan` (as lender); has many `Transfer` (from/to); has many `Installment` via "InstallmentFunding" (savings accounts that fund debtor-linked installments); has many `VaultEntry` via "VaultFundingSource" (entries sourced from this account reduce its computed balance); has many `Wallet` (its envelope partitions, ADR-036)

---

### Wallet
**NEW (ADR-036/037, Milestone C1).** An envelope partition *inside* a `SavingsAccount`. An account with no
split has exactly one (default) wallet named after the account; Bancolombia splits into `debit/daily`,
`savings`, and `investments`. This is the entity a MoneyLover-parity "wallet" maps to — not the institution
itself.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| accountId | String | FK → SavingsAccount (cascade delete) |
| name | String | Partition name, e.g. "savings", "debit/daily", or the account name for a single-wallet account. Unique per account (`@@unique([accountId, name])`). |
| color | String? | Optional hex color for UI |
| sortOrder | Int | Display order within the account (default 0) |
| isSavings | Boolean | Flag 1 — is this wallet part of the savings/Loans surface at all? Set at C1 migration time as `debit/daily` = false, every other wallet = true; since amended in data for `investments` (also flipped to false — Daniel wants it entirely off the Loans/savings surface, not just excluded from the liquidity KPI). No per-wallet settings UI exists yet to change this outside a direct DB write (deferred to C2, see `docs/backlog.md`). |
| includeInAvailable | Boolean | Flag 2 — moved down from `SavingsAccount` (ADR-036). Within savings, does it count toward the liquid `available` KPI? (Protección, investments = false) |
| openingBalance | Float | Reconciliation anchor — the wallet's real balance as of `openingDate` (ADR-037) |
| openingDate | DateTime | The balance "epoch" — only flows dated on/after this date move the balance forward |

**A wallet counts toward the liquidity KPI iff `isSavings && includeInAvailable`.**

**Balance formula (ADR-037):** `openingBalance + Σ(flows dated >= openingDate)`, where flows are signed
`Transaction`s (via `walletId`) plus `Loan`s given / `LoanPayment`s / `VaultEntry` funding (all via their
own wallet FK) plus — only for the wallet that is its account's `savingsWalletId` — that account's
`AccountEntry` and `Transfer` rows (not yet wallet-aware themselves; C2/C3). The `date >= openingDate` guard
applies to every flow term: pre-epoch flows are already folded into `openingBalance`, so re-counting them
would double-count. Pure math lives in `src/lib/wallet-balance-utils.ts` (`computeWalletBalance`), shared by
`getWalletBalances()` (`src/lib/queries/wallets.ts`) and the `getLoansOverview()`/`getSavingsAccounts()`
refactor.

**Surfaces (different subsets of the same per-wallet numbers):** Home/Overview = `grandTotal = Σ ALL
wallet.balance` (the real bank balance, `getWalletBalances()`). Loans/savings = `Σ wallet.balance WHERE
isSavings` (`getLoansOverview()`'s per-account `balance`). Liquidity KPI = `available = Σ wallet.balance
WHERE isSavings && includeInAvailable` (`getLoansOverview()`'s `available`, unchanged formula/shape,
ADR-021).

**Relations:** belongs to `SavingsAccount`; has many `Transaction`; has many `Loan` (as source wallet); has many `VaultEntry` via "VaultFundingWallet" (as source wallet); is pointed to by `SavingsAccount.savingsWalletId` / `.defaultWalletId`

---

### AccountEntry
Ledger entry that drives a SavingsAccount's balance. One INITIAL entry sets opening balance; ADJUSTMENT entries record deposits, withdrawals, or corrections.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| accountId | String | FK → SavingsAccount (cascade delete) |
| type | EntryType enum | INITIAL or ADJUSTMENT |
| amount | Float | Positive or negative (COP) |
| date | DateTime | Entry date |
| notes | String? | Optional notes |

---

### Transfer
Moves funds between two SavingsAccounts. Both sides reference the same record.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| fromAccountId | String | FK → SavingsAccount |
| toAccountId | String | FK → SavingsAccount |
| amount | Float | Amount transferred (COP) |
| date | DateTime | Transfer date |
| notes | String? | Optional notes |

---

### Debtor
A named person who owes money to the user.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| name | String (unique) | Debtor's name |
| notes | String? | Optional notes |

**Relations:** has many `Loan`; has many `Installment` (installments bought on behalf of this debtor)

---

### Loan
A specific amount lent to a Debtor, sourced from a SavingsAccount. Remaining balance is always computed from payments — never stored.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| debtorId | String | FK → Debtor |
| accountId | String | FK → SavingsAccount (source of funds) |
| amount | Float | Original loan amount (COP) |
| date | DateTime | When the loan was made |
| expectedBy | DateTime? | Optional repayment target date |
| notes | String? | Optional notes |
| createdAt | DateTime | Record creation time |
| walletId | String? | FK → Wallet (ADR-036/037) — source wallet. C1 always defaults it to the account's `savingsWalletId` (set by `createLoan`/`updateLoan`); per-transaction wallet selection is a C2 follow-up. |

**Relations:** has many `LoanPayment`; belongs to an optional `Wallet` (source)

---

### LoanPayment
A partial or full repayment of a Loan.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| loanId | String | FK → Loan (cascade delete) |
| amount | Float | Payment amount (COP) |
| date | DateTime | Payment date |
| notes | String? | Optional notes |

---

### Vault
A named goal-based savings pocket. Isolated from the SavingsAccount/liquidity model (ADR-014). Balance is computed — never stored (ADR-006).

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| name | String (unique) | e.g. "Emergency Fund", "Trip to Japan" |
| kind | VaultKind enum | MANDATORY or LEISURE |
| goalType | VaultGoalType enum | FIXED_DEADLINE, OPEN_ENDED, or RECURRING |
| targetAmount | Float? | Required when goalType = FIXED_DEADLINE |
| targetDate | DateTime? | Required when goalType = FIXED_DEADLINE |
| color | String? | Hex color for UI tile accent strip |
| notes | String? | Optional notes |
| archivedAt | DateTime? | Set when goal met or abandoned; record is kept for history |
| createdAt | DateTime | Record creation time |

**Relations:** has many `VaultEntry`; has many `RecurringExpense` (via `"VaultRecurring"` relation name)

---

### RecurringExpense
A non-monthly cost the user expects to pay on a recurring cadence. Source of truth for due dates and set-aside math.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| name | String | e.g. "Tecnomecánica", "Car insurance" |
| estimatedAmount | Float | Expected cost in COP |
| cadenceMonths | Int | Recurrence interval (1=monthly, 6=semiannual, 12=annual) |
| nextDueDate | DateTime | When the next payment falls due |
| category | String? | Free label (e.g. "Vehicle", "Taxes") |
| fundingVaultId | String? | FK → Vault (optional; the RECURRING vault that holds the money) |
| active | Boolean | Default true; set false to deactivate without deleting |
| notes | String? | Optional notes |
| createdAt | DateTime | Record creation time |

**Relations:** belongs to `Vault` (optional, via `"VaultRecurring"`); has many `RecurringExpensePayment`

---

### RecurringExpensePayment
Ledger of paid cycles. Created atomically with the vault withdrawal in `payRecurringExpense`.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| recurringExpenseId | String | FK → RecurringExpense (cascade delete) |
| amount | Float | Actual amount paid (may differ from estimate) |
| dueDate | DateTime | The cycle this payment satisfied (the previous `nextDueDate`) |
| paidAt | DateTime | When the payment was recorded |
| vaultEntryId | String? | FK to the VaultEntry withdrawal, if paid from a vault |
| notes | String? | Optional notes |

---

### VaultEntry
Ledger entry for a vault. Positive = contribution, negative = withdrawal.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| vaultId | String | FK → Vault (cascade delete) |
| amount | Float | Signed amount in COP |
| date | DateTime | Entry date (defaults to now) |
| notes | String? | Optional notes |
| createdAt | DateTime | Record creation time |
| sourceAccountId | String? | FK → SavingsAccount via "VaultFundingSource" (optional). When set, this entry is a sourced contribution — the amount is deducted from that account's computed balance. Null = notional earmark (no account balance impact). |
| sourceWalletId | String? | FK → Wallet via "VaultFundingWallet" (ADR-036/037, optional) — alongside `sourceAccountId` (kept for backward-compat; derivable from the wallet). C1 always defaults it to the source account's `savingsWalletId` (set by `addVaultEntry`); per-transaction wallet selection is a C2 follow-up. |
| transactionId | String? @unique | (ADR-045) FK → Transaction (optional). Set only when the contribution was funded via a specific wallet + category (`addVaultEntry({ walletId, appCategoryId })`) — a real, categorized `Transaction` was created alongside this entry, and the wallet's balance drops through the normal transaction sum rather than the `sourceWalletId` earmark subtraction (`wallet-balance-utils.ts` excludes any entry with `transactionId` set from that earmark term, to avoid double-counting). Deleting a `VaultEntry` with `transactionId` set cascades to delete the linked `Transaction` too (`deleteVaultEntry`). Null = either the legacy/notional `sourceAccountId`-only path or a fully notional entry. |

`VaultEntryRow` (the query return type) also exposes `sourceAccountName: string | null` (resolved from the relation).

---

### ChatMessage
Persisted conversation history for the AI advisor. Up to 20 recent messages are sent to Claude on each request. History is shared across channels (web + Telegram + Shortcut ingest) for continuity.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| role | String | "user" or "assistant" |
| content | String | Full message text |
| channel | String? | "web" \| "telegram" \| "shortcut" — null = legacy/unknown. For filtering/debugging; history is shared by default. |
| createdAt | DateTime | Message timestamp |

---

### PendingProposal
A persisted record of every proposal the agent has emitted, across all channels. The unified approval path (`resolveProposal`) looks up and acts on these records.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key — used as the `proposalId` in NDJSON events and Telegram `callback_data` |
| action | String | Proposal tool name, e.g. "propose_vault_contribution" |
| params | Json | Validated arguments for the server action |
| title | String | Human-readable title built by the agent |
| status | String | "pending" \| "approved" \| "dismissed" \| "expired" \| "undone" (default: "pending") |
| channel | String | "web" or "telegram" — which channel surfaced this proposal |
| editable | Json? | `EditableField[]` (ADR-031) — option list for the proposal's editable fields (e.g. category), persisted at creation time so Telegram's index-based edit callback can resolve `optIdx → option.id` without re-running the agent. Null for proposals with no editable field (every tool except `propose_add_transaction` today). |
| createdAt | DateTime | When the proposal was emitted |
| resolvedAt | DateTime? | When the user approved or dismissed it |

## Enums

| Enum | Values |
|---|---|
| BudgetType | FIXED, VARIABLE |
| AccountType | BANK, DIGITAL, PENSION |
| EntryType | INITIAL, ADJUSTMENT |
| VaultKind | MANDATORY, LEISURE |
| VaultGoalType | FIXED_DEADLINE, OPEN_ENDED, RECURRING |
| RuleMatchType | ACCOUNT, MERCHANT, SENDER, KEYWORD |
| RuleDirection | EXPENSE, INCOME, ANY |
