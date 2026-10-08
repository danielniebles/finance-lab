// Read-tool dispatch — tools that execute immediately and return data
// (never mutate). Split out of run-agent-turn.ts (see docs/backlog.md
// god-file item). Mirrors the name→handler registry shape actions.ts uses
// for PROPOSAL_ACTIONS, per backend-nextjs.md guidance.

import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { getFinancialSnapshot } from "@/lib/queries/chat";
import { getHealthScore } from "@/lib/queries/health-score";
import { getAvailableMonths, getMonthlyAnalysis, getCategories } from "@/lib/queries/expenses";
import { financialMonthYear, getFinancialPeriodBounds } from "@/lib/financial-period-utils";
import { getTrends } from "@/lib/queries/trends";
import { getAllInstallments, getMonthSummary } from "@/lib/queries/installments";
import { getLoansOverview } from "@/lib/queries/loans";
import { getVaults, getVaultObligations } from "@/lib/queries/vaults";
import { getRecurringExpenses } from "@/lib/queries/recurring";
import { getForecast } from "@/lib/queries/forecast";
import { listDriveFiles } from "@/lib/actions/drive";
import { getCounterpartyRules } from "@/lib/queries/counterparty-rules";

export const READ_TOOLS = new Set([
  "get_overview",
  "get_available_months",
  "get_monthly_analysis",
  "get_transactions",
  "get_trends",
  "get_installments",
  "get_loans",
  "get_vaults",
  "get_vault_obligations",
  "get_recurring_expenses",
  "get_forecast",
  "get_categories",
  "list_drive_files",
  "get_counterparty_rules",
]);

// ─── fetch helpers ─────────────────────────────────────────────────────────────

function fetchTrends(input: Record<string, unknown>): Promise<unknown> {
  const n = input.n ? Math.min(Number(input.n), 12) : 6;
  return getTrends(n);
}

async function fetchOverview(): Promise<unknown> {
  const [snapshot, healthScore] = await Promise.all([
    getFinancialSnapshot(),
    getHealthScore(),
  ]);
  return { snapshot, healthScore };
}

// Same parse as getAvailableMonths / getTransactionList (src/lib/queries).
function financialStartDay(): number {
  return parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
}

// "This month" = the current FINANCIAL month, matching Overview and the health
// score (never the server's calendar month — UTC on Vercel).
async function fetchInstallments(): Promise<unknown> {
  const { month, year } = financialMonthYear(new Date(), financialStartDay());
  const [installments, monthSummary] = await Promise.all([
    getAllInstallments(),
    getMonthSummary(month, year),
  ]);
  return { installments, monthSummary };
}

// Case-insensitive partial match on the EFFECTIVE app category (ADR-030):
// a direct appCategory (MANUAL) wins; the MoneyLover mapping only counts when
// the row has no direct category, so a recategorised row never matches its
// stale mapped name.
function categoryWhere(category: string | undefined): Prisma.TransactionWhereInput {
  if (!category) return {};
  const name = { contains: category, mode: "insensitive" as const };
  return {
    OR: [
      { appCategory: { name } },
      { appCategoryId: null, moneyLoverCategory: { mapping: { appCategory: { name } } } },
    ],
  };
}

function requestedMonth(input: Record<string, unknown>, startDay: number): { month: number; year: number } {
  const month = Number(input.month);
  const year = Number(input.year);
  const valid = Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(year);
  if (valid) return { month, year };
  return financialMonthYear(new Date(), startDay);
}

type AgentTransactionRow = Prisma.TransactionGetPayload<{
  include: {
    appCategory: true;
    moneyLoverCategory: { include: { mapping: { include: { appCategory: true } } } };
    walletRef: true;
  };
}>;

// ADR-030: direct appCategory (MANUAL) wins, else the MoneyLover mapping.
// `category` is the source label — the MoneyLover category for legacy rows,
// else the app category — so MANUAL rows never show null.
function categoryLabels(t: AgentTransactionRow): { category: string | null; appCategory: string | null } {
  const appCategory = (t.appCategory ?? t.moneyLoverCategory?.mapping?.appCategory)?.name ?? null;
  return { category: t.moneyLoverCategory?.name ?? appCategory, appCategory };
}

function toAgentTransaction(t: AgentTransactionRow) {
  return {
    id: t.id,
    date: t.date,
    amount: t.amount,
    ...categoryLabels(t),
    note: t.note,
    wallet: t.walletRef?.name ?? t.wallet,
    isTransfer: t.isTransfer,
  };
}

const TRANSACTION_CAP = 200;

// Date-range scoped like getTransactionList / getMonthlyAnalysis, so months
// logged in-app (MANUAL, no ImportBatch) are returned alongside historical
// MoneyLover rows. Transfer legs are returned but flagged — they are never
// income or spending anywhere in the app.
async function fetchTransactions(input: Record<string, unknown>): Promise<unknown> {
  const startDay = financialStartDay();
  const { month, year } = requestedMonth(input, startDay);
  const { start, end } = getFinancialPeriodBounds(month, year, startDay);

  const rows = await db.transaction.findMany({
    where: {
      date: { gte: start, lt: end },
      ...categoryWhere(input.category as string | undefined),
    },
    include: {
      appCategory: true,
      moneyLoverCategory: {
        include: { mapping: { include: { appCategory: true } } },
      },
      walletRef: true,
    },
    orderBy: { date: "asc" },
    take: TRANSACTION_CAP + 1,
  });

  // One extra row tells us the cap was hit, so the model knows the list is partial.
  return {
    transactions: rows.slice(0, TRANSACTION_CAP).map(toAgentTransaction),
    truncated: rows.length > TRANSACTION_CAP,
  };
}

// ─── Registry ──────────────────────────────────────────────────────────────────

type ReadToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

const READ_TOOL_HANDLERS: Record<string, ReadToolHandler> = {
  get_overview: () => fetchOverview(),
  get_available_months: () => getAvailableMonths(),
  get_monthly_analysis: (input) => getMonthlyAnalysis(Number(input.month), Number(input.year)),
  get_transactions: (input) => fetchTransactions(input),
  get_trends: (input) => fetchTrends(input),
  get_installments: () => fetchInstallments(),
  get_loans: () => getLoansOverview(),
  get_vaults: () => getVaults(),
  get_vault_obligations: (input) => getVaultObligations(Number(input.month), Number(input.year)),
  get_recurring_expenses: (input) => getRecurringExpenses(Number(input.month), Number(input.year)),
  get_forecast: (input) => getForecast(Number(input.month), Number(input.year)),
  get_categories: () => getCategories(),
  list_drive_files: () => listDriveFiles(),
  get_counterparty_rules: () => getCounterpartyRules(),
};

export async function runReadTool(
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  const handler = READ_TOOL_HANDLERS[name];
  if (!handler) return { error: `Unknown read tool: ${name}` };
  return handler(input);
}
