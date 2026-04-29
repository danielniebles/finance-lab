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

**Relations:** has many `InstallmentPayment`

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

**Relations:** has many `AccountEntry`; has many `Loan` (as lender); has many `Transfer` (from/to)

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

**Relations:** has many `Loan`

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

### ChatMessage
Persisted conversation history for the AI advisor. Up to 20 recent messages are sent to Claude on each request.

| Field | Type | Description |
|---|---|---|
| id | String (cuid) | Primary key |
| role | String | "user" or "assistant" |
| content | String | Full message text |
| createdAt | DateTime | Message timestamp |

## Enums

| Enum | Values |
|---|---|
| BudgetType | FIXED, VARIABLE |
| AccountType | BANK, DIGITAL, PENSION |
| EntryType | INITIAL, ADJUSTMENT |
