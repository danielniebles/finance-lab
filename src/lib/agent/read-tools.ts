// Read-tool dispatch — tools that execute immediately and return data
// (never mutate). Split out of run-agent-turn.ts (see docs/backlog.md
// god-file item). Mirrors the name→handler registry shape actions.ts uses
// for PROPOSAL_ACTIONS, per backend-nextjs.md guidance.

import { db } from "@/lib/db";
import { getFinancialSnapshot } from "@/lib/queries/chat";
import { getHealthScore } from "@/lib/queries/health-score";
import { getImportBatches, getMonthlyAnalysis, getCategories } from "@/lib/queries/expenses";
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

async function fetchInstallments(): Promise<unknown> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const [installments, monthSummary] = await Promise.all([
    getAllInstallments(),
    getMonthSummary(month, year),
  ]);
  return { installments, monthSummary };
}

async function fetchTransactions(input: Record<string, unknown>): Promise<unknown> {
  const month = Number(input.month);
  const year = Number(input.year);
  const category = input.category as string | undefined;

  const batch = await db.importBatch.findFirst({
    where: { month, year },
  });
  if (!batch) return { transactions: [] };

  const rows = await db.transaction.findMany({
    where: {
      batchId: batch.id,
      ...(category
        ? {
            moneyLoverCategory: {
              mapping: {
                appCategory: {
                  name: { contains: category, mode: "insensitive" },
                },
              },
            },
          }
        : {}),
    },
    include: {
      moneyLoverCategory: {
        include: { mapping: { include: { appCategory: true } } },
      },
      walletRef: true,
    },
    orderBy: { date: "asc" },
    take: 200,
  });

  return {
    transactions: rows.map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      category: t.moneyLoverCategory?.name ?? null,
      appCategory:
        t.moneyLoverCategory?.mapping?.appCategory?.name ?? null,
      note: t.note,
      wallet: t.walletRef?.name ?? t.wallet,
    })),
  };
}

// ─── Registry ──────────────────────────────────────────────────────────────────

type ReadToolHandler = (input: Record<string, unknown>) => Promise<unknown>;

const READ_TOOL_HANDLERS: Record<string, ReadToolHandler> = {
  get_overview: () => fetchOverview(),
  get_available_months: () => getImportBatches(),
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
