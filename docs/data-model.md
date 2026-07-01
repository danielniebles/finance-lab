# Data Model

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

**Relations:** has many `CategoryMapping`; has many `BudgetItem`

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
A single row from a MoneyLover XLSX export. Positive amount = income; negative = expense.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| externalId | Int | MoneyLover's own row ID |
| date | DateTime | Transaction date |
| amount | Float | Positive = income, negative = expense (COP) |
| wallet | String | MoneyLover wallet name |
| note | String? | Optional note |
| batchId | String | FK → ImportBatch (cascade delete) |
| moneyLoverCategoryId | String | FK → MoneyLoverCategory |

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
A personal savings or investment account. Balance is computed from entries + transfers − loans.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| name | String (unique) | Account label |
| accountType | AccountType enum | BANK, DIGITAL, or PENSION |
| color | String? | Hex color for UI |
| includeInAvailable | Boolean | Whether to count toward liquid available |

**Relations:** has many `AccountEntry`; has many `Loan` (as lender); has many `Transfer` (from/to); has many `Installment` via "InstallmentFunding" (savings accounts that fund debtor-linked installments); has many `VaultEntry` via "VaultFundingSource" (entries sourced from this account reduce its computed balance)

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

**Relations:** has many `LoanPayment`

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

`VaultEntryRow` (the query return type) also exposes `sourceAccountName: string | null` (resolved from the relation).

---

### ChatMessage
Persisted conversation history for the AI advisor. Up to 20 recent messages are sent to Claude on each request. History is shared across channels (web + Telegram) for continuity.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| role | String | "user" or "assistant" |
| content | String | Full message text |
| channel | String? | "web" or "telegram" — null = legacy/unknown. For filtering/debugging; history is shared by default. |
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
| status | String | "pending" \| "approved" \| "dismissed" \| "expired" (default: "pending") |
| channel | String | "web" or "telegram" — which channel surfaced this proposal |
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
