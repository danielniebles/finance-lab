import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ToolResultBlockParam, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { db } from "@/lib/db";
import { saveMessage } from "@/lib/actions/chat";
import { getFinancialSnapshot } from "@/lib/queries/chat";
import { getHealthScore } from "@/lib/queries/health-score";
import { getImportBatches, getMonthlyAnalysis } from "@/lib/queries/expenses";
import { getTrends } from "@/lib/queries/trends";
import { getAllInstallments, getCardSummaries, getMonthSummary } from "@/lib/queries/installments";
import { getLoansOverview } from "@/lib/queries/loans";
import { getVaults, getVaultObligations } from "@/lib/queries/vaults";
import { getRecurringExpenses } from "@/lib/queries/recurring";
import { getForecast } from "@/lib/queries/forecast";
import { listDriveFiles } from "@/lib/actions/drive";
import { computeInstallmentDue } from "@/lib/installment-utils";
import { isDueInMonth } from "@/lib/installment-utils";
import { formatCOP } from "@/lib/format";
import type { AgentTurnResult, ProposalDescriptor } from "./types";
import { buildSystemPrompt } from "./prompt";

const anthropic = new Anthropic();

// ─── Tool definitions ─────────────────────────────────────────────────────────

const READ_TOOLS = new Set([
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
  "list_drive_files",
]);

const PROPOSAL_TOOLS = new Set([
  "propose_create_vault",
  "propose_update_vault",
  "propose_vault_contribution",
  "propose_vault_withdrawal",
  "propose_archive_vault",
  "propose_create_recurring_expense",
  "propose_pay_recurring",
  "propose_import_from_drive",
  "propose_create_installment",
  "propose_mark_installment_paid",
  "propose_create_loan",
  "propose_record_loan_payment",
  "propose_undo_last",
]);

const TOOLS: Anthropic.Tool[] = [
  // ── Read tools ──
  {
    name: "get_overview",
    description:
      "Get a high-level financial briefing across all modules: expenses, savings, installments, loans, and vaults. Call this first when the user asks a general question about their finances.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_available_months",
    description: "Get the list of months that have imported expense data.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_monthly_analysis",
    description:
      "Get the full budget/actual/severity breakdown for a specific month. Use this when the user asks about a particular month's expenses.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "number", description: "Month number (1–12)" },
        year: { type: "number", description: "4-digit year" },
      },
      required: ["month", "year"],
    },
  },
  {
    name: "get_transactions",
    description:
      "Get individual transactions for a month, optionally filtered by category name.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "number", description: "Month number (1–12)" },
        year: { type: "number", description: "4-digit year" },
        category: {
          type: "string",
          description: "Optional: filter by app category name (case-insensitive partial match)",
        },
      },
      required: ["month", "year"],
    },
  },
  {
    name: "get_trends",
    description:
      "Get multi-month income/expense/savings-rate trend data. Defaults to last 6 months.",
    input_schema: {
      type: "object",
      properties: {
        n: {
          type: "number",
          description: "Number of months to look back (default 6, max 12)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_installments",
    description:
      "Get all installments (active and finished) plus the current month obligation summary.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_loans",
    description:
      "Get savings accounts, debtors, active loans, and liquidity KPIs.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_vaults",
    description:
      "Get all active vaults with their computed balance, progress, required-this-month, and status.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_vault_obligations",
    description:
      "Get per-vault required/contributed/still-needed amounts for a specific month.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "number", description: "Month number (1–12)" },
        year: { type: "number", description: "4-digit year" },
      },
      required: ["month", "year"],
    },
  },

  // ── Proposal tools ──
  {
    name: "propose_create_vault",
    description:
      "Propose creating a new vault. Emits an action card for the user to approve — does NOT mutate data.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Vault name" },
        kind: {
          type: "string",
          enum: ["MANDATORY", "LEISURE"],
          description: "Vault kind",
        },
        goalType: {
          type: "string",
          enum: ["FIXED_DEADLINE", "OPEN_ENDED", "RECURRING"],
          description: "Vault goal type",
        },
        targetAmount: {
          type: "number",
          description: "Required for FIXED_DEADLINE — target amount in COP",
        },
        targetDate: {
          type: "string",
          description:
            "Required for FIXED_DEADLINE — ISO date string (YYYY-MM-DD)",
        },
      },
      required: ["name", "goalType"],
    },
  },
  {
    name: "propose_update_vault",
    description:
      "Propose updating an existing vault's fields. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        vaultId: { type: "string", description: "Vault ID to update" },
        name: { type: "string" },
        kind: { type: "string", enum: ["MANDATORY", "LEISURE"] },
        goalType: { type: "string", enum: ["FIXED_DEADLINE", "OPEN_ENDED"] },
        targetAmount: { type: "number" },
        targetDate: { type: "string" },
        color: { type: "string" },
        notes: { type: "string" },
      },
      required: ["vaultId"],
    },
  },
  {
    name: "propose_vault_contribution",
    description:
      "Propose adding a contribution (positive entry) to a vault. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        vaultId: { type: "string", description: "Vault ID" },
        amount: {
          type: "number",
          description: "Contribution amount in COP (positive)",
        },
        date: {
          type: "string",
          description: "Optional ISO date (YYYY-MM-DD), defaults to today",
        },
        notes: { type: "string", description: "Optional notes" },
        sourceAccountId: {
          type: "string",
          description: "Optional savings account ID to source the funds from. When set, the amount is deducted from that account's available balance (real money movement). Omit for a notional earmark that does not affect account balances.",
        },
      },
      required: ["vaultId", "amount"],
    },
  },
  {
    name: "propose_vault_withdrawal",
    description:
      "Propose a withdrawal (negative entry) from a vault. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        vaultId: { type: "string", description: "Vault ID" },
        amount: {
          type: "number",
          description: "Withdrawal amount in COP (positive — will be negated)",
        },
        date: {
          type: "string",
          description: "Optional ISO date (YYYY-MM-DD)",
        },
        notes: { type: "string", description: "Optional notes" },
        sourceAccountId: {
          type: "string",
          description: "Optional savings account ID that originally funded this vault (for returning money). When set, the withdrawal increases that account's available balance.",
        },
      },
      required: ["vaultId", "amount"],
    },
  },
  {
    name: "propose_archive_vault",
    description:
      "Propose archiving a vault (met goal or abandoned). Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        vaultId: { type: "string", description: "Vault ID to archive" },
      },
      required: ["vaultId"],
    },
  },

  // ── Recurring expense tools ──
  {
    name: "get_recurring_expenses",
    description:
      "Get all active recurring expenses with computed set-aside amounts and status for a given month. Use this when the user asks about upcoming bills, what they need to save this month, or recurring obligations.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "number", description: "Month number (1-12)" },
        year: { type: "number", description: "4-digit year" },
      },
      required: ["month", "year"],
    },
  },
  {
    name: "get_forecast",
    description:
      "Get a historical forecast for a given month: projected savings rate, per-category landing ranges, and top overspend drivers. Based on past import data only — labels outputs as projections, returns insufficient history if < 3 months of data.",
    input_schema: {
      type: "object",
      properties: {
        month: { type: "number", description: "Month number (1–12)" },
        year: { type: "number", description: "4-digit year" },
      },
      required: ["month", "year"],
    },
  },
  {
    name: "propose_create_recurring_expense",
    description:
      "Propose registering a new recurring expense. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        estimatedAmount: { type: "number", description: "Estimated amount in COP" },
        cadenceMonths: {
          type: "number",
          description: "Recurrence in months (1=monthly, 6=semiannual, 12=annual)",
        },
        nextDueDate: { type: "string", description: "Next due date (YYYY-MM-DD)" },
        category: { type: "string" },
        fundingVaultId: {
          type: "string",
          description: "ID of a RECURRING vault to link",
        },
      },
      required: ["name", "estimatedAmount", "cadenceMonths", "nextDueDate"],
    },
  },
  {
    name: "propose_pay_recurring",
    description:
      "Propose recording a payment for a recurring expense and rolling its cycle forward. Optionally withdraws from a linked vault. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "RecurringExpense ID" },
        amount: { type: "number", description: "Actual amount paid in COP" },
        fromVaultId: {
          type: "string",
          description: "Vault ID to withdraw from (optional)",
        },
      },
      required: ["id", "amount"],
    },
  },

  // ── Drive import tool ──
  {
    name: "list_drive_files",
    description: "List MoneyLover XLSX files available in the configured Google Drive folder, ordered by most recently modified.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "propose_import_from_drive",
    description:
      "Propose importing a MoneyLover file from Google Drive. If no fileId is specified, auto-picks the most recent file. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        fileId: { type: "string", description: "Drive file ID (optional — auto-picks most recent if omitted)" },
        status: {
          type: "string",
          enum: ["IN_PROGRESS", "FINAL"],
          description: "Override batch status (optional — heuristic default: current month → IN_PROGRESS, past month → FINAL)",
        },
      },
      required: [],
    },
  },

  // ── Installment tools ──
  {
    name: "propose_create_installment",
    description:
      "Propose registering a new installment (cuota purchase). Shows a true-cost preview including interest. Emits an action card — does NOT mutate. Call get_installments first to check existing cards.",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Item description" },
        totalAmount: { type: "number", description: "Total purchase amount in COP" },
        numInstallments: { type: "number", description: "Number of installments" },
        monthlyInterestRate: { type: "number", description: "Monthly interest rate % (optional, 0 if none)" },
        startDate: { type: "string", description: "ISO date of first payment (YYYY-MM-DD)" },
        cardName: { type: "string", description: "Credit card name (optional). If it does not exist, a new card will be created." },
        fundingAccountName: { type: "string", description: "Savings account name to fund this (optional, only when bought for a debtor)" },
      },
      required: ["description", "totalAmount", "numInstallments", "startDate"],
    },
  },
  {
    name: "propose_mark_installment_paid",
    description:
      "Propose marking a cuota as paid for a given month. Call get_installments first to resolve the installment name and find the correct slot. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        installmentName: { type: "string", description: "Description of the installment (partial match OK)" },
        month: { type: "number", description: "Month number (1–12), defaults to current month" },
        year: { type: "number", description: "4-digit year, defaults to current year" },
      },
      required: ["installmentName"],
    },
  },

  // ── Loan tools ──
  {
    name: "propose_create_loan",
    description:
      "Propose recording a new loan to a debtor, sourced from a savings account. Call get_loans first to resolve names. If the debtor doesn't exist they will be created in the same proposal. Savings accounts CANNOT be auto-created — ask the user which account to use. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "Loan amount in COP" },
        debtorName: { type: "string", description: "Debtor name (existing or new)" },
        fundingAccountName: { type: "string", description: "Savings account name to source from (must exist)" },
        date: { type: "string", description: "Loan date ISO (YYYY-MM-DD), defaults to today" },
        expectedBy: { type: "string", description: "Expected repayment date ISO (optional)" },
        notes: { type: "string", description: "Notes (optional)" },
      },
      required: ["amount", "debtorName", "fundingAccountName"],
    },
  },
  {
    name: "propose_record_loan_payment",
    description:
      "Propose recording a repayment received from a debtor. Call get_loans first to resolve debtor and loan. If debtor has multiple active loans, the oldest is targeted. Emits an action card — does NOT mutate.",
    input_schema: {
      type: "object",
      properties: {
        debtorName: { type: "string", description: "Debtor name" },
        amount: { type: "number", description: "Payment amount in COP" },
        date: { type: "string", description: "Payment date ISO (YYYY-MM-DD), defaults to today" },
        notes: { type: "string", description: "Notes (optional)" },
      },
      required: ["debtorName", "amount"],
    },
  },

  // ── Undo tool ──
  {
    name: "propose_undo_last",
    description:
      "Propose reversing the last approved conversational write (createInstallment, markPayment, createLoan, recordPayment, createDebtor, createCard). Imports cannot be undone. Emits an action card — does NOT mutate.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

// ─── Read tool executor ───────────────────────────────────────────────────────

async function runReadTool(
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "get_overview": {
      const [snapshot, healthScore] = await Promise.all([
        getFinancialSnapshot(),
        getHealthScore(),
      ]);
      return { snapshot, healthScore };
    }
    case "get_available_months": {
      return getImportBatches();
    }
    case "get_monthly_analysis": {
      const month = Number(input.month);
      const year = Number(input.year);
      return getMonthlyAnalysis(month, year);
    }
    case "get_transactions": {
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
        },
        orderBy: { date: "asc" },
        take: 200,
      });

      return {
        transactions: rows.map((t) => ({
          id: t.id,
          date: t.date,
          amount: t.amount,
          category: t.moneyLoverCategory.name,
          appCategory:
            t.moneyLoverCategory.mapping?.appCategory?.name ?? null,
          note: t.note,
          wallet: t.wallet,
        })),
      };
    }
    case "get_trends": {
      const n = input.n ? Math.min(Number(input.n), 12) : 6;
      return getTrends(n);
    }
    case "get_installments": {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const [installments, monthSummary] = await Promise.all([
        getAllInstallments(),
        getMonthSummary(month, year),
      ]);
      return { installments, monthSummary };
    }
    case "get_loans": {
      return getLoansOverview();
    }
    case "get_vaults": {
      return getVaults();
    }
    case "get_vault_obligations": {
      const month = Number(input.month);
      const year = Number(input.year);
      return getVaultObligations(month, year);
    }
    case "get_recurring_expenses": {
      const month = Number(input.month);
      const year = Number(input.year);
      return getRecurringExpenses(month, year);
    }
    case "get_forecast": {
      const month = Number(input.month);
      const year = Number(input.year);
      return getForecast(month, year);
    }
    case "list_drive_files": {
      return listDriveFiles();
    }
    default:
      return { error: `Unknown read tool: ${name}` };
  }
}

// ─── Proposal helpers ─────────────────────────────────────────────────────────

function formatParamKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function formatParamValue(key: string, value: unknown): string {
  if (value == null) return "—";
  if (
    (key === "amount" || key === "targetAmount" || key === "estimatedAmount") &&
    typeof value === "number"
  ) {
    return `$${new Intl.NumberFormat("es-CO").format(Math.round(value))} COP`;
  }
  if (key === "targetDate" || key === "date" || key === "nextDueDate") {
    try {
      return new Date(value as string).toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function buildProposalTitle(name: string, input: Record<string, unknown>): string {
  const fmt = (v: unknown) =>
    typeof v === "number"
      ? `$${new Intl.NumberFormat("es-CO").format(Math.round(v))} COP`
      : String(v ?? "");

  switch (name) {
    case "propose_create_vault":
      return `Create vault: ${input.name ?? "?"}`;
    case "propose_update_vault":
      return `Update vault ${input.vaultId}`;
    case "propose_vault_contribution":
      return input.sourceAccountId
        ? `Contribute ${fmt(input.amount)} to vault ${input.vaultId} from account ${input.sourceAccountId}`
        : `Contribute ${fmt(input.amount)} to vault ${input.vaultId}`;
    case "propose_vault_withdrawal":
      return input.sourceAccountId
        ? `Withdraw ${fmt(input.amount)} from vault ${input.vaultId} (returns to account ${input.sourceAccountId})`
        : `Withdraw ${fmt(input.amount)} from vault ${input.vaultId}`;
    case "propose_archive_vault":
      return `Archive vault ${input.vaultId}`;
    case "propose_create_recurring_expense":
      return `Add recurring expense: ${input.name ?? "?"}, ${fmt(input.estimatedAmount)} every ${input.cadenceMonths}mo`;
    case "propose_pay_recurring":
      return `Pay recurring expense ${input.id}: ${fmt(input.amount)}${input.fromVaultId ? ` from vault ${input.fromVaultId}` : ""}`;
    case "propose_import_from_drive":
      return `Import from Drive: ${input.fileName ?? input.fileId ?? "latest file"}`;
    case "propose_create_installment":
      return `Create installment: ${input.description ?? "?"} — ${fmt(input.totalAmount)} × ${input.numInstallments}`;
    case "propose_mark_installment_paid":
      return `Mark cuota paid: ${input.installmentName ?? "?"}`;
    case "propose_create_loan":
      return `Create loan: ${fmt(input.amount)} → ${input.debtorName ?? "?"}`;
    case "propose_record_loan_payment":
      return `Record payment: ${fmt(input.amount)} from ${input.debtorName ?? "?"}`;
    case "propose_undo_last":
      return `Undo: ${input.originalAction ?? "last action"}`;
    default:
      return name;
  }
}

function buildProposalFields(
  input: Record<string, unknown>,
): { label: string; value: string }[] {
  // Skip internal ID fields from display
  const skipKeys = new Set([
    "vaultId", "id", "sourceAccountId", "fromVaultId", "fundingVaultId",
    "cardId", "debtorId", "accountId", "installmentId", "loanId",
    "targetProposalId", "createCard", "createDebtor", "createdId", "createdDebtorId",
  ]);
  return Object.entries(input)
    .filter(([k]) => !skipKeys.has(k))
    .map(([k, v]) => ({ label: formatParamKey(k), value: formatParamValue(k, v) }));
}

// ─── Complex proposal resolvers ───────────────────────────────────────────────
// These run before PendingProposal is persisted.
// They resolve names → IDs, compute previews, and return enriched params + fields.

type ResolvedProposal = {
  params: Record<string, unknown>;
  title: string;
  fields: { label: string; value: string }[];
  /** If set, return this as a plain text tool result instead of creating a proposal */
  blockingMessage?: string;
};

async function resolveComplexProposal(
  toolName: string,
  input: Record<string, unknown>,
): Promise<ResolvedProposal | null> {
  // Returns null → use default simple resolution
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // ── propose_import_from_drive ──────────────────────────────────────────────
  if (toolName === "propose_import_from_drive") {
    let fileId = input.fileId as string | undefined;
    let fileName = input.fileName as string | undefined;
    const statusOverride = input.status as string | undefined;

    if (!fileId) {
      const files = await listDriveFiles();
      if (files.length === 0) return { params: input, title: "Import from Drive", fields: [], blockingMessage: "No files found in the configured Drive folder." };
      fileId = files[0].id;
      fileName = files[0].name;
    }

    // Guess month from filename pattern like "MoneyLover_2026_07" or similar
    const monthMatch = fileName?.match(/(\d{4})[_-](\d{2})/);
    let detectedLabel = fileName ?? fileId;
    if (monthMatch) {
      const y = parseInt(monthMatch[1]);
      const m = parseInt(monthMatch[2]);
      const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      detectedLabel = `${MONTH_NAMES[m - 1]} ${y}`;
    }

    const resolvedStatus = statusOverride ?? (
      monthMatch && parseInt(monthMatch[1]) === currentYear && parseInt(monthMatch[2]) === currentMonth
        ? "IN_PROGRESS"
        : "FINAL"
    );

    const params = { fileId, fileName: fileName ?? fileId, status: resolvedStatus };
    const title = `Import from Drive: ${fileName ?? fileId}`;
    const fields = [
      { label: "File", value: fileName ?? fileId ?? "?" },
      { label: "Detected period", value: detectedLabel },
      { label: "Batch status", value: resolvedStatus === "IN_PROGRESS" ? "IN PROGRESS (mid-month)" : "FINAL" },
    ];
    return { params, title, fields };
  }

  // ── propose_create_installment ──────────────────────────────────────────────
  if (toolName === "propose_create_installment") {
    const description = input.description as string;
    const totalAmount = Number(input.totalAmount);
    const numInstallments = Number(input.numInstallments);
    const monthlyInterestRate = input.monthlyInterestRate != null ? Number(input.monthlyInterestRate) : 0;
    const startDate = input.startDate as string;
    const cardName = input.cardName as string | undefined;
    const fundingAccountName = input.fundingAccountName as string | undefined;

    // Resolve card
    let cardId: string | null = null;
    let createsCard = false;
    if (cardName) {
      const cards = await getCardSummaries(currentMonth, currentYear);
      const found = cards.find((c) => c.name.toLowerCase() === cardName.toLowerCase());
      if (found) {
        cardId = found.id;
      } else {
        createsCard = true;
      }
    }

    // Resolve funding account
    let fundingAccountId: string | null = null;
    if (fundingAccountName) {
      const overview = await getLoansOverview();
      const found = overview.accounts.find(
        (a) => a.name.toLowerCase() === fundingAccountName.toLowerCase(),
      );
      if (found) fundingAccountId = found.id;
    }

    // True-cost preview (German amortization)
    const monthlyCapital = Math.round(totalAmount / numInstallments);
    const firstCuotaTotal = computeInstallmentDue(totalAmount, numInstallments, 1, monthlyInterestRate);
    let totalInterest = 0;
    for (let k = 1; k <= numInstallments; k++) {
      totalInterest += computeInstallmentDue(totalAmount, numInstallments, k, monthlyInterestRate) - monthlyCapital;
    }
    const totalRepaid = totalAmount + totalInterest;

    const params: Record<string, unknown> = {
      description,
      totalAmount,
      numInstallments,
      monthlyInterestRate: monthlyInterestRate || null,
      startDate,
      cardId,
      fundingAccountId,
      ...(createsCard && cardName ? { createCard: { name: cardName } } : {}),
    };

    const title = `Create installment: ${description} — ${formatCOP(totalAmount)} × ${numInstallments}`;
    const fields: { label: string; value: string }[] = [
      { label: "Item", value: description },
      { label: "Total amount", value: formatCOP(totalAmount) },
      { label: "Monthly capital", value: formatCOP(monthlyCapital) },
      { label: "First cuota (with interest)", value: formatCOP(firstCuotaTotal) },
      { label: "Total interest", value: formatCOP(totalInterest) },
      { label: "Total repaid", value: formatCOP(totalRepaid) },
      { label: "Installments", value: String(numInstallments) },
      { label: "Card", value: cardName ? `${cardName}${createsCard ? " ⚠ new card will be created" : ""}` : "—" },
      { label: "Start date", value: startDate },
    ];

    return { params, title, fields };
  }

  // ── propose_mark_installment_paid ──────────────────────────────────────────
  if (toolName === "propose_mark_installment_paid") {
    const installmentName = input.installmentName as string;
    const targetMonth = input.month ? Number(input.month) : currentMonth;
    const targetYear = input.year ? Number(input.year) : currentYear;

    const installments = await getAllInstallments();
    const found = installments.find((i) =>
      i.description.toLowerCase().includes(installmentName.toLowerCase()),
    );

    if (!found) {
      return {
        params: input,
        title: "Mark cuota paid",
        fields: [],
        blockingMessage: `No installment found matching "${installmentName}". Call get_installments to see available installments.`,
      };
    }

    // Find the correct slot k for the target month
    let installmentNum: number | null = null;
    for (let k = 1; k <= found.numInstallments; k++) {
      if (isDueInMonth(found.startDate, k, targetMonth, targetYear)) {
        installmentNum = k;
        break;
      }
    }

    if (installmentNum === null) {
      return {
        params: input,
        title: "Mark cuota paid",
        fields: [],
        blockingMessage: `No cuota found for "${found.description}" in ${targetMonth}/${targetYear}.`,
      };
    }

    const amount = computeInstallmentDue(found.totalAmount, found.numInstallments, installmentNum, found.monthlyInterestRate ?? undefined);
    const paidAt = new Date().toISOString();

    const params: Record<string, unknown> = {
      installmentId: found.id,
      installmentNum,
      paidAt,
    };

    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const title = `Mark cuota ${installmentNum}/${found.numInstallments} paid: ${found.description}`;
    const fields: { label: string; value: string }[] = [
      { label: "Installment", value: found.description },
      { label: "Cuota", value: `${installmentNum} / ${found.numInstallments}` },
      { label: "Month", value: `${MONTH_NAMES[targetMonth - 1]} ${targetYear}` },
      { label: "Amount due", value: formatCOP(amount) },
    ];

    return { params, title, fields };
  }

  // ── propose_create_loan ────────────────────────────────────────────────────
  if (toolName === "propose_create_loan") {
    const amount = Number(input.amount);
    const debtorName = input.debtorName as string;
    const fundingAccountName = input.fundingAccountName as string;
    const date = (input.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
    const expectedBy = input.expectedBy as string | undefined;
    const notes = input.notes as string | undefined;

    const overview = await getLoansOverview();
    const accountFound = overview.accounts.find(
      (a) => a.name.toLowerCase() === fundingAccountName.toLowerCase(),
    );

    if (!accountFound) {
      return {
        params: input,
        title: "Create loan",
        fields: [],
        blockingMessage: `Savings account "${fundingAccountName}" not found. Available accounts: ${overview.accounts.map((a) => a.name).join(", ")}. Ask the user which account to use.`,
      };
    }

    const debtorFound = overview.debtors.find(
      (d) => d.name.toLowerCase() === debtorName.toLowerCase(),
    );
    const createsDebtor = !debtorFound;
    const debtorId = debtorFound?.id ?? null;

    const params: Record<string, unknown> = {
      amount,
      debtorId,
      accountId: accountFound.id,
      date,
      expectedBy: expectedBy ?? null,
      notes: notes ?? null,
      ...(createsDebtor ? { createDebtor: { name: debtorName } } : {}),
    };

    const title = `Create loan: ${formatCOP(amount)} → ${debtorName}`;
    const fields: { label: string; value: string }[] = [
      { label: "Amount", value: formatCOP(amount) },
      { label: "Debtor", value: `${debtorName}${createsDebtor ? " ⚠ new debtor will be created" : ""}` },
      { label: "From account", value: fundingAccountName },
      { label: "Expected by", value: expectedBy ?? "—" },
      { label: "Notes", value: notes ?? "—" },
    ];

    return { params, title, fields };
  }

  // ── propose_record_loan_payment ────────────────────────────────────────────
  if (toolName === "propose_record_loan_payment") {
    const debtorName = input.debtorName as string;
    const amount = Number(input.amount);
    const date = (input.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
    const notes = input.notes as string | undefined;

    const overview = await getLoansOverview();
    const debtor = overview.debtors.find(
      (d) => d.name.toLowerCase() === debtorName.toLowerCase(),
    );

    if (!debtor) {
      return {
        params: input,
        title: "Record loan payment",
        fields: [],
        blockingMessage: `Debtor "${debtorName}" not found. Call get_loans to see debtors.`,
      };
    }

    const activeLoans = debtor.loans
      .filter((l) => l.isActive)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (activeLoans.length === 0) {
      return {
        params: input,
        title: "Record loan payment",
        fields: [],
        blockingMessage: `No active loans found for "${debtorName}".`,
      };
    }

    // Target oldest active loan
    const targetLoan = activeLoans[0];
    const resultingBalance = Math.max(0, targetLoan.remaining - amount);

    const params: Record<string, unknown> = {
      loanId: targetLoan.id,
      debtorName,
      amount,
      date,
      notes: notes ?? null,
    };

    const title = `Record payment: ${formatCOP(amount)} from ${debtorName}`;
    const fields: { label: string; value: string }[] = [
      { label: "Debtor", value: debtorName },
      { label: "Amount", value: formatCOP(amount) },
      { label: "Loan", value: targetLoan.notes ?? `Loan of ${formatCOP(targetLoan.amount)}` },
      { label: "Current outstanding", value: formatCOP(targetLoan.remaining) },
      { label: "Resulting balance", value: formatCOP(resultingBalance) },
      { label: "Date", value: date },
      ...(notes ? [{ label: "Notes", value: notes }] : []),
    ];

    if (activeLoans.length > 1) {
      fields.push({ label: "Note", value: `${debtorName} has ${activeLoans.length} active loans — payment applied to oldest.` });
    }

    return { params, title, fields };
  }

  // ── propose_undo_last ──────────────────────────────────────────────────────
  if (toolName === "propose_undo_last") {
    const reversibleActions = [
      "createInstallment", "markPayment", "createLoan", "recordPayment",
      "createDebtor", "createCard",
    ];

    const lastApproved = await db.pendingProposal.findFirst({
      where: {
        status: "approved",
        action: { in: reversibleActions },
      },
      orderBy: { resolvedAt: "desc" },
    });

    if (!lastApproved) {
      return {
        params: {},
        title: "Undo last action",
        fields: [],
        blockingMessage: "No reversible recent action found.",
      };
    }

    const resolvedAtLabel = lastApproved.resolvedAt
      ? new Date(lastApproved.resolvedAt).toLocaleDateString("es-CO", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : "unknown time";

    const params: Record<string, unknown> = {
      targetProposalId: lastApproved.id,
      originalAction: lastApproved.action,
    };

    const title = `Undo: ${lastApproved.action} from ${resolvedAtLabel}`;
    const fields: { label: string; value: string }[] = [
      { label: "Reversing", value: `${lastApproved.action} from ${resolvedAtLabel}` },
      { label: "Original title", value: lastApproved.title },
    ];

    return { params, title, fields };
  }

  return null;
}

// ─── Channel-agnostic agent turn ─────────────────────────────────────────────

export async function runAgentTurn(args: {
  messages: { role: "user" | "assistant"; content: string }[];
  context?: { module?: string; focus?: { month: number; year: number }; entityId?: string; route?: string };
  onTextDelta?: (delta: string) => void;
  channel?: "web" | "telegram";
}): Promise<AgentTurnResult> {
  const { messages: inputMessages, context, onTextDelta, channel = "web" } = args;

  const now = new Date();
  const systemPrompt = buildSystemPrompt({ now, context });

  // Guard against orphaned consecutive user messages.
  // Keep the most recent user message; strip extra trailing user messages.
  let history = [...inputMessages];
  let trailingUsers = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") trailingUsers++;
    else break;
  }
  if (trailingUsers > 1) {
    history = [
      ...history.slice(0, history.length - trailingUsers),
      history[history.length - 1],
    ];
  }

  const messages: MessageParam[] = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const proposals: ProposalDescriptor[] = [];
  let fullText = "";
  let lastTool: string | null = null;

  try {
    // Tool-use loop
    while (true) {
      const res = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });

      if (res.stop_reason === "tool_use") {
        const toolResults: ToolResultBlockParam[] = [];

        for (const block of res.content) {
          if (block.type !== "tool_use") continue;
          const toolBlock = block as ToolUseBlock;
          const toolInput = toolBlock.input as Record<string, unknown>;

          if (READ_TOOLS.has(toolBlock.name)) {
            lastTool = toolBlock.name;
            try {
              const data = await runReadTool(toolBlock.name, toolInput);
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolBlock.id,
                content: JSON.stringify(data),
              });
            } catch (err) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolBlock.id,
                content: `Error executing tool: ${err instanceof Error ? err.message : String(err)}`,
                is_error: true,
              });
            }
          } else if (PROPOSAL_TOOLS.has(toolBlock.name)) {
            lastTool = toolBlock.name;

            // Run complex resolution (name lookups, previews) for new tools
            const resolved = await resolveComplexProposal(toolBlock.name, toolInput);

            // If resolution produced a blocking message, return it as an error result
            if (resolved?.blockingMessage) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolBlock.id,
                content: resolved.blockingMessage,
                is_error: true,
              });
              continue;
            }

            // Build final params, title, fields
            const finalParams = resolved ? resolved.params : toolInput;
            const title = resolved ? resolved.title : buildProposalTitle(toolBlock.name, toolInput);
            const fields = resolved ? resolved.fields : buildProposalFields(toolInput);

            // Map tool name to action name (drop "propose_" prefix for storage)
            const actionName = toolBlock.name.replace(/^propose_/, "");

            // Persist a PendingProposal record
            const pendingProposal = await db.pendingProposal.create({
              data: {
                action: actionName,
                params: finalParams as unknown as Record<string, string>,
                title,
                channel,
              },
            });

            const descriptor: ProposalDescriptor = {
              id: pendingProposal.id,
              action: actionName,
              params: finalParams,
              title,
              fields,
              reasoning: "",
              choices: [
                { id: "approve", label: "Approve", style: "primary" },
                { id: "dismiss", label: "Dismiss" },
              ],
            };
            proposals.push(descriptor);

            toolResults.push({
              type: "tool_result",
              tool_use_id: toolBlock.id,
              content: "Proposal surfaced to the user for approval.",
            });
          } else {
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolBlock.id,
              content: `Unknown tool: ${toolBlock.name}`,
              is_error: true,
            });
          }
        }

        messages.push({ role: "assistant", content: res.content });
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // end_turn — collect text blocks
      for (const block of res.content) {
        if (block.type === "text") {
          fullText += block.text;
          if (onTextDelta) onTextDelta(block.text);
        }
      }

      break;
    }
  } catch (err) {
    const errorMsg = "Something went wrong. Please try again.";
    if (onTextDelta) onTextDelta(errorMsg);
    fullText = errorMsg;
    // Keep message history valid — always save an assistant turn after every user turn
    await saveMessage("assistant", errorMsg).catch(() => {});
    console.error("[run-agent-turn] outer catch:", {
      error: err instanceof Error ? { message: err.message, name: err.name } : String(err),
      historyLength: history.length,
      lastTool,
    });
  }

  return { text: fullText, proposals };
}
