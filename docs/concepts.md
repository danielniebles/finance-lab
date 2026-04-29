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
A deferred-payment purchase split across N months (e.g. a phone on 12-cuotas). Uses German amortization (cuota decreciente): fixed capital per payment plus decreasing interest on the outstanding balance. The `monthlyAmount` stored in the DB is always the capital portion (P/n); the actual due amount for payment k is computed at read-time via `computeInstallmentDue`.

**Savings account**
A personal savings or investment account the user controls. Balance is derived from a ledger of `AccountEntry` records (INITIAL + ADJUSTMENTs) plus transfer flows. Loans given reduce the available balance.

**Loan**
Money lent by the user to a named `Debtor`, sourced from one of their savings accounts. Repaid through `LoanPayment` records. The remaining balance is always computed — never stored.

**Health Score**
A composite 0–100 score computed from four equally-weighted metrics (25 points each): Savings Rate, Variable Burn Rate, Installment Burden, and Liquidity Ratio. Tiers: Excellent (≥85), Good (≥65), Fair (≥45), At Risk (<45).

**Financial snapshot**
A plain-text summary of the user's finances injected into every AI advisor request as the system prompt. Generated server-side from live DB data at `src/lib/queries/chat.ts:getFinancialSnapshot`.

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
| savings rate | (income − expenses) / income × 100 |
| liquidity ratio | liquid available / (liquid available + loans out) × 100 |
| installment burden | monthly installment obligation / income × 100 |
