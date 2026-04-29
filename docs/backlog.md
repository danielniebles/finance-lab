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
- **Prompt caching:** The AI advisor sends a fresh `getFinancialSnapshot()` string as the system prompt on every message. Since the snapshot is identical within a session, adding `cache_control: { type: "ephemeral" }` on the system prompt block would reduce Claude API costs by up to 90% for the repeated prefix.
- **Category mapping UI:** Currently, unmapped MoneyLover categories are shown as a count with a link to the mappings settings page. An inline mapping shortcut on the expenses dashboard would speed up the post-import workflow.
- **Import from Drive — auto-detect latest:** The Drive integration lists files and requires manual selection. An "import latest" button that automatically picks the most-recently-modified file would reduce clicks.
- **Installment interest rate display:** The installment form accepts a monthly interest rate but the dashboard does not prominently display the total interest cost over the installment's life. Showing `total interest = sum(interest_k for k in 1..n)` would help the user evaluate purchases.
- **Loan age warnings:** The loans UI already computes loan age but any "overdue" alerting relies on `expectedBy` being set. A fallback warning for loans over N days old with no `expectedBy` would surface forgotten debts.
- **Multi-currency / multi-user:** The app is explicitly single-user and COP-only. No architecture changes are needed for these until explicitly requested.
