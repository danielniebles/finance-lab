# Financial Model — North Star

> The reference for *what Finance Lab is trying to be* and the model that makes it
> accurate enough to rely on. Read this before planning any new module. It defines the
> mental model (Plan vs Actuals), the concepts that fill today's gaps, how the agent uses
> them, and a phased roadmap. Module-mechanics live in the per-feature handoffs; this is
> the why and the shape.

---

## 1. The core idea — a Plan layer beside Actuals

Finance Lab today is almost entirely **retrospective**: it imports a MoneyLover month and
tells you what already happened, in one-month chunks, scored against a *flat monthly
budget*. That flat budget is the only forward-looking thing in the app, and it can only
represent costs that are smooth and monthly.

Every remaining pain point shares one root cause: **there is no model of the future that
isn't monthly.** The fix is a single new layer.

- **Actuals** (exists) — imported transactions, computed balances, severity. The record of
  what happened.
- **Plan** (new) — expected *inflows* (salary, primas) and expected *non-monthly outflows*
  (annual/semiannual costs). The record of what's coming.
- **Reconciliation** (new, mostly agent + queries) — the app's real job becomes comparing
  the two: *"given what's coming, here's what you must set aside this month, and here's
  where you'll actually land."*

Everything below is either a Plan input, an Actuals reading, or a reconciliation output.

---

## 2. Design principles

1. **Plan is proportional, not total.** You only formally plan what is *material relative
   to income* (a non-monthly cost above a threshold, or any income event). Small, noisy
   spending stays absorbed by the variable budget and the Emergency vault. The agent
   *suggests promoting* something to a planned item once it grows big or regular enough.
   This keeps setup effort scaled to stakes.
2. **Resilient to the unplanned.** Emergencies, windfalls, and ad-hoc lending must degrade
   gracefully. The plan never assumes perfection; an Emergency vault is the shock absorber
   and the natural source for lending, so surprises don't drain core savings.
3. **Balances are computed, never stored** (ADR-006). Every new balance/required-amount is
   derived from a ledger at read time. No new source-of-truth columns.
4. **The agent proposes, never acts** (ADR-015 / `agent.md`). Every new capability is
   additive read tools + `propose_*` tools mapping to validated server actions.
5. **Re-spread is the default for shortfalls.** Required-this-month is always
   `remaining / periods-left`. Falling behind a period silently raises the next period's
   requirement — no auto-debt, no auto-raid of savings.

---

## 3. Module map (current + planned)

| Module | Job | Status |
|---|---|---|
| Expenses | Actuals: import, categorize, budget vs actual, severity | shipped |
| Trends | Actuals over 3/6/12 months | shipped |
| Installments | Bank obligations: finite deferred purchases + cards | shipped |
| Loans | Liquidity: savings accounts + money owed to you | shipped |
| **Vaults** | Earmarked savings with a purpose | shipped |
| Overview + Agent | Health Score + propose-then-confirm agent | shipped |
| **Recurring expenses** | Plan: calendar of non-monthly costs | **planned (Phase A)** |
| **Sinking-fund vaults** | Money for the recurring calendar | **planned (Phase A)** |
| **Income plan** | Plan: expected salary + primas + allocation rules | **planned (Phase B)** |
| **Forecasting** | Reconciliation: projected landing + early warning | **shipped (Phase C)** |
| **Liquidity-aware advice** | Reconciliation: loan exposure + emergency buffer | **planned (Phase D)** |

Module relationships unchanged at the boundary level: Installments = bank obligations,
Loans = liquidity, Vaults = earmarked savings. The Plan layer **feeds** Vaults (sinking
funds) and **informs** the agent's reconciliation; it does not blur the existing boundaries.

---

## 4. New concepts

### 4.1 Recurring expense (the calendar) — Phase A

A non-monthly cost you know is coming: taxes, oil change, tecnomecánica, insurance.

- Fields: `name`, `estimatedAmount`, `cadenceMonths` (1/6/12/custom), `nextDueDate`,
  `category` (label), optional `fundingVaultId`.
- It is the **source of truth for due dates**. The app projects the forward calendar.
- Monthly set-aside = `estimatedAmount / monthsUntilDue` (re-spread, principle §2.5).
- On payment, the cycle rolls: `nextDueDate += cadenceMonths`, set-aside recomputes.

Solves **pain #3** (ambushes) — every due date is visible months out.

### 4.2 Sinking-fund vault (the money) — Phase A

A vault whose required-this-month is the **sum of set-asides of its linked recurring
expenses**, instead of a single goal. You fund it monthly; when an item is due you pay
*from the vault* (a withdrawal), not from savings.

- Implemented as a third `goalType` on the existing `Vault`: `RECURRING`.
- `FIXED_DEADLINE` and `OPEN_ENDED` are unchanged.
- Reuses the entire vault ledger, banner, and agent surface — minimal new surface.

Solves **pain #5** (annual/semiannual paid from savings).

### 4.3 Income event + allocation rule (the primas) — Phase B

- `IncomeEvent`: `label`, `expectedMonth`/`expectedDate`, `expectedAmount`, `kind`
  (SALARY | PRIMA | OTHER), `received` flag.
- `AllocationRule`: when an event lands, route a **percentage** (default; robust to
  variable prima sizes) to one or more vaults / sinking funds.
- **Receipt signal = the Savings module, not MoneyLover.** Primas land in a wallet Daniel
  does not import; he records them as a positive `AccountEntry`. Reconciliation watches for
  matching savings entries and the agent proposes mark-received + the split (suggestion-only,
  never auto-marked).
- **Allocations are account-sourced** (see 4.6): routing a prima into a vault moves that money
  out of the savings account's *available* into the vault — mirroring moving cash to a real
  bank pocket. The unallocated remainder stays as free cash.
- The agent reminds before the event and, when it lands, **proposes the split** as one action
  card naming the source account. Manual override always available.

Solves **pain #4** (primas meant-to-save but spent).

### 4.6 Vault funding revision (account-sourced contributions) — prerequisite for Phase B

A vault contribution may optionally name a `sourceAccountId`. This **revises ADR-014** (vaults
were fully standalone):

- **Sourced** contribution → real move: reduces that account's *available* balance. The money is
  reported as a **separate `inVaults` figure**, NOT rolled into `totalSavings` — so
  `liquidityRatio` and the Health Score stay unchanged. (`netWorth = totalSavings + inVaults` is
  the conserved quantity, shown as an optional informational line.)
- **Unsourced** contribution → notional earmark, unchanged from today (outside the liquidity model).
- Mixed freely; existing vault entries remain valid (no backfill). Handoff:
  `.handoff/vault-funding-revision/HANDOFF.md` (ADR-021).

### 4.4 Forecasting (the volatility) — Phase C *(shipped)*

No new module — a query + agent surfacing.

- Uses trend history to predict a **likely landing range** per variable category (recency-weighted mean ± 1 std dev over last 6 import batches) and a **projected month-end savings rate** from the predicted variable total + fixed budget + trailing income average.
- Early warning: "trending toward 9% savings, not the 20% you expected."
- The `ForecastPanel` server component shows the projected savings rate, vs-target/vs-last-month deltas, and the top overspend drivers. A thin-data state renders when fewer than MIN_MONTHS (3) months of history exist.
- Mid-month pacing (reading partial-month actuals to compute spend-so-far) is deferred — see backlog.

Solves **pain #2** (land lower than expected) with no change to the monthly import habit.

### 4.5 Liquidity-aware advice + Emergency vault (the lending) — Phase D

- Your constant lending is liquidity that is **committed but recoverable**. Treat
  outstanding loans as illiquid-but-recoverable and expected repayments as **soft** future
  inflows (never counted as guaranteed available cash).
- An **Emergency vault** (`OPEN_ENDED`) is both the shock absorber for unplanned costs and
  the natural source you lend from — so emergencies and favors stop hitting core savings.
- The agent factors loan exposure into every "safe to set aside" recommendation.

---

## 5. How the five pains resolve

| Pain | Solved by | Phase |
|---|---|---|
| 1. Purposeful savings (stop raiding) | Vaults | shipped |
| 2. Land lower than expected | Forecasting | C |
| 3. Every-X-month ambushes | Recurring-expense registry | A |
| 4. Primas spent not saved | Income events + allocation rules | B |
| 5. Annual/semiannual paid from savings | Sinking-fund vault | A |
| (clarified) lending + emergencies | Emergency vault + liquidity-aware advice | D |

---

## 6. Agent scope (expanded)

The agent stays propose-then-confirm (`agent.md`). Each phase adds read tools and proposal
tools — cheap, since the registration pattern exists in `src/app/api/chat/route.ts`.

**New read tools:** `get_recurring_expenses`, `get_income_plan`, `get_forecast`,
`get_liquidity_exposure`.

**New proposal tools:** `propose_create_recurring_expense`, `propose_pay_recurring`,
`propose_income_event`, `propose_allocation`, `propose_fund_recurring`.

**The monthly reconciliation briefing** becomes the headline agent behavior:

> "Set aside **X total** this month across vaults + sinking funds. A prima of ~**Y** lands
> in August — plan to save **Z** (70%). **Tecnomecánica** is due in September and you're one
> month behind pace. Your savings rate is trending to **9%**. You have **W** committed in
> active loans; keep the Emergency vault above its floor before funding Travel."

This is the "fully rely on it" experience, and it is entirely additive tooling over the
shipped foundation.

---

## 7. Roadmap (pain ÷ cost order)

- **Phase A — Recurring expenses + sinking-fund vault** (#3, #5). Highest pain, lowest cost
  (reuses vault infra). Detailed handoff: `.handoff/recurring-sinking-funds/HANDOFF.md`. *(shipped)*
- **Vault-funding revision** — optional account-sourced contributions (4.6). Prerequisite for
  Phase B. Handoff: `.handoff/vault-funding-revision/HANDOFF.md`.
- **Phase B — Income events + allocation rules** (#4). Handoff: `.handoff/income-allocation/HANDOFF.md`.
- **Phase C — Forecasting + projection** (#2). *(shipped)*
- **Phase D — Liquidity-aware advice + Emergency vault integration** (lending/emergencies).

Each phase ends by registering its agent tools and updating `agent.md` §4 + the docs.

---

## 8. ADR bookkeeping

`docs/decisions.md` records through **ADR-017** (vaults backfill + Phase A landed). Continue:

- **ADR-014** — Vaults are a standalone ledger (not liquidity). *(recorded)*
- **ADR-015** — Agent upgrade: tool use + propose-then-confirm (supersedes ADR-009). *(recorded)*
- **ADR-016** — Plan layer beside Actuals (this document's core model). *(recorded)*
- **ADR-017** — Recurring expense registry feeds a `RECURRING` vault shape. *(recorded)*
- **ADR-018** — Income events + percentage allocation rules; receipt reconciled against Savings
  entries (not MoneyLover); account-sourced allocations. *(Phase B)*
- **ADR-019** — Forecasting from trend history (likely-landing range). *(Phase C)*
- **ADR-020** — Soft inflows: loans recoverable-but-illiquid; Emergency vault as buffer. *(Phase D)*
- **ADR-021** — Vault funding: optional `sourceAccountId`; sourced money leaves *available* and is
  shown as a **separate `inVaults` figure** (not in `totalSavings`, so Health Score is untouched).
  Amends ADR-014. *(prerequisite for B)*
