# Concepts

## What this project is
Finance Lab is a personal finance tracking application built for a single user living in Colombia. It imports expense data from the MoneyLover mobile app, maps raw categories to a custom budget structure, and provides dashboards for monthly expense analysis, installment obligations, loan/savings tracking, and trend charts. An AI advisor (Claude Haiku) answers questions about the user's real financial data. All amounts are in Colombian Pesos (COP).

## Core domain concepts

**MoneyLover import**
The app does not record transactions directly. It reads XLSX exports from the MoneyLover mobile app. Each import covers one calendar month and is stored as an `ImportBatch`. Re-importing the same month replaces the existing batch atomically.

**MoneyLoverCategory**
Raw category names as they appear in MoneyLover exports (e.g. "Food & Dining", "Salary"). These are discovered dynamically on import — never pre-seeded. They have no budget meaning until mapped to an AppCategory.

**AppCategory**
User-defined simplified categories with semantic meaning (e.g. "Groceries", "Transport"). Each AppCategory has one or more `BudgetItem` lines of type FIXED or VARIABLE. Multiple MoneyLover categories can map to a single AppCategory.

**BudgetType**
A category is FIXED when all its budget items are fixed-cost (rent, subscriptions), VARIABLE when all items are discretionary, or MIXED when it has both. This drives how severity is calculated: fixed categories flag deviation from exact budget; variable categories flag proportional overrun.

**Category severity**
Health of a category relative to its budget for a given month. Four tiers: OK, Issue, Critical, Unplanned. Logic lives in `src/lib/queries/expenses.ts:classifyCategory`.

**Installment**
A deferred-payment purchase split across N months (e.g. a phone on 12-cuotas). Uses German amortization (cuota decreciente): fixed capital per payment plus decreasing interest on the outstanding balance. The `monthlyAmount` stored in the DB is always the capital portion (P/n); the actual due amount for payment k is computed at read-time via `computeInstallmentDue`. An installment may be optionally linked to a `CreditCard` (which card was charged), a `Debtor` (if bought on behalf of someone else), and a `SavingsAccount` (the account that disbursed the cash when debtorId is set).

**CreditCard**
A bank credit card belonging to the user. Lives in the **Installments module** — not the Loans module. Credit cards are an *obligations* concept (what Daniel owes the bank, month by month, card by card), not a *liquidity* concept. Tracking a credit card here means the Installments dashboard can show total outstanding debt and monthly obligation per card. `CreditCard` records are never represented as `SavingsAccount` entries — the two domains must not be mixed.

**Installments vs Loans module boundary**
The Loans module is a *liquidity tracker*: savings accounts Daniel controls + money owed **to** Daniel by debtors. The Installments module is an *obligations tracker*: what Daniel owes the bank, month by month. This boundary is intentional. A `Debtor` record may appear in both modules (formal cash loans via Loans, credit-funded purchases via Installments) because a debtor is a person, not a module concept.

**Savings account**
A personal savings or investment account the user controls. Balance is derived from a ledger of `AccountEntry` records (INITIAL + ADJUSTMENTs) plus transfer flows. Loans given reduce the available balance.

**Loan**
Money lent by the user to a named `Debtor`, sourced from one of their savings accounts. Repaid through `LoanPayment` records. The remaining balance is always computed — never stored.

**Health Score**
A composite 0–100 score computed from four equally-weighted metrics (25 points each): Savings Rate, Variable Burn Rate, Installment Burden, and Liquidity Ratio. Tiers: Excellent (≥85), Good (≥65), Fair (≥45), At Risk (<45).

**Vault**
A named, goal-based savings pocket. Distinct from `SavingsAccount` — vault balances are earmarked, not liquid (ADR-014). Three shapes: `FIXED_DEADLINE` (target amount + target date; auto re-spreads required contribution on shortfall), `OPEN_ENDED` (no deadline, optional aspirational target), and `RECURRING` (sinking fund; `requiredThisMonth` = sum of set-asides from linked recurring expenses). Two kinds: `MANDATORY` (must-fund, e.g. taxes) and `LEISURE` (wants, e.g. a trip). Balance is always computed from `VaultEntry` records — never stored (ADR-006).

**VaultEntry**
A ledger record for a vault. Positive amount = contribution, negative = withdrawal. The vault balance is `sum(entries.amount)`.

**Vault status**
Computed monthly for each vault:
| Status | Condition |
|---|---|
| Met | balance ≥ targetAmount (FIXED_DEADLINE) |
| On track | contributedThisMonth ≥ requiredThisMonth |
| Behind | contributedThisMonth < requiredThisMonth, targetDate not past (FIXED_DEADLINE) |
| Overdue | targetDate is past and balance < targetAmount (FIXED_DEADLINE) |
| Open | OPEN_ENDED vault |
| Underfunded | contributedThisMonth < requiredThisMonth (RECURRING vault) |

**Recurring expense**
A non-monthly cost you know is coming (taxes, oil change, car inspection, insurance). Fields: `name`, `estimatedAmount`, `cadenceMonths` (1/3/6/12/custom), `nextDueDate`, optional `category` label, optional `fundingVaultId`. The source of truth for when bills land. Monthly set-aside = `estimatedAmount / monthsUntilDue` (re-spread: falling behind one month silently raises the next month's requirement). On payment the cycle rolls: `nextDueDate += cadenceMonths`.

**Sinking-fund vault**
A vault with `goalType = RECURRING`. Its `requiredThisMonth` is the sum of set-asides from all linked `RecurringExpense` records — not a single deadline split. You fund it monthly; when an item is due you pay from the vault (a negative `VaultEntry`), not from savings. See ADR-017.

**Set-aside**
`estimatedAmount / monthsUntilDue` — the amount you should put into the sinking fund this month to be on pace for a specific recurring expense. Re-computed fresh each month; no stored balance needed (ADR-006).

**Agent**
The in-app AI advisor, backed by `claude-sonnet-4-6` via the Anthropic SDK. Supersedes the old static-snapshot advisor (ADR-015). Uses a tool-use loop: the model calls read tools to fetch live data and proposal tools to surface action cards. Proposal tools never mutate — the user must click Approve on an action card to trigger the real server action. The agent is module-context-aware: pages pass `{ route, module, focus, entityId }` context so questions like "how am I doing this month?" resolve against the current view. Full spec in `docs/agent.md`.

**Financial snapshot**
A plain-text summary of the user's finances, now used as the body of the `get_overview` read tool (rather than injected as the system prompt on every message). Generated server-side from live DB data at `src/lib/queries/chat.ts:getFinancialSnapshot`.

## Glossary
| Term | Meaning |
|---|---|
| COP | Colombian Peso — the only currency used |
| m.v. | Mensual vencido — Colombian term for effective monthly interest rate |
| EA | Effective annual interest rate (converted to/from m.v. in `installment-utils.ts`) |
| cuota | Installment payment |
| cuota decreciente | German amortization — fixed capital + decreasing interest |
| ImportBatch | One XLSX import covering one calendar month |
| MoneyLoverCategory | Raw category name from MoneyLover export |
| AppCategory | User-defined budget category with budget line items |
| CategoryMapping | Link from a MoneyLoverCategory to an AppCategory (1:1) |
| BudgetItem | A single line within an AppCategory budget (name, amount, FIXED or VARIABLE) |
| burn rate | Variable actual spend as a % of variable budget |
| sinking fund | A RECURRING vault that accumulates monthly set-asides to cover non-monthly bills |
| set-aside | estimatedAmount / monthsUntilDue — the monthly contribution pace for one recurring expense |
| cadence | Recurrence interval in months (cadenceMonths). 1 = monthly, 6 = semiannual, 12 = annual |
| savings rate | (income − expenses) / income × 100 |
| liquidity ratio | liquid available / (liquid available + loans out) × 100 |
| installment burden | monthly installment obligation / income × 100 |
