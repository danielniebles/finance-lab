import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ToolResultBlockParam, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { db } from "@/lib/db";
import { saveMessage } from "@/lib/actions/chat";
import { getFinancialSnapshot } from "@/lib/queries/chat";
import { getHealthScore } from "@/lib/queries/health-score";
import { getImportBatches, getMonthlyAnalysis } from "@/lib/queries/expenses";
import { getTrends } from "@/lib/queries/trends";
import { getAllInstallments, getMonthSummary } from "@/lib/queries/installments";
import { getLoansOverview } from "@/lib/queries/loans";
import { getVaults, getVaultObligations } from "@/lib/queries/vaults";
import { getRecurringExpenses } from "@/lib/queries/recurring";
import { getForecast } from "@/lib/queries/forecast";
import type { AgentTurnResult, ProposalDescriptor } from "./types";

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
]);

const PROPOSAL_TOOLS = new Set([
  "propose_create_vault",
  "propose_update_vault",
  "propose_vault_contribution",
  "propose_vault_withdrawal",
  "propose_archive_vault",
  "propose_create_recurring_expense",
  "propose_pay_recurring",
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
    default:
      return name;
  }
}

function buildProposalFields(
  input: Record<string, unknown>,
): { label: string; value: string }[] {
  // Skip internal ID fields from display
  const skipKeys = new Set(["vaultId", "id", "sourceAccountId", "fromVaultId", "fundingVaultId"]);
  return Object.entries(input)
    .filter(([k]) => !skipKeys.has(k))
    .map(([k, v]) => ({ label: formatParamKey(k), value: formatParamValue(k, v) }));
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
  const dateStr = now.toLocaleDateString("en-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build context line for system prompt
  let contextLine = "";
  if (context?.module) {
    const focusPart = context.focus
      ? ` (month ${context.focus.month}/${context.focus.year})`
      : "";
    const entityPart = context.entityId ? `, entity: ${context.entityId}` : "";
    contextLine = `\nThe user is currently viewing: ${context.module}${focusPart}${entityPart}.`;
  } else if (context?.route) {
    contextLine = `\nThe user is currently viewing: ${context.route}.`;
  }

  const systemPrompt =
    `You are a personal financial operator for a single user in Colombia. All amounts in COP. Today is ${dateStr}.

You have live access to the user's financial data via tools. Read before you answer. Never estimate when a tool can tell you.

Propose, never act: for any change to the user's data, call a proposal tool. A proposal surfaces an action card for the user to approve. You cannot mutate data directly.

One proposal per card. State your reasoning before proposing.

Say "drafted for your approval," never "done."

Vaults come in three types: FIXED_DEADLINE (saving toward a goal by a date), OPEN_ENDED (no deadline), and RECURRING (sinking fund for non-monthly costs). A RECURRING vault's requiredThisMonth reflects the sum of set-asides from its linked recurring expenses.

A vault contribution may optionally name a source savings account (sourceAccountId). Sourced contributions move real money out of that account's available balance into the vault — use propose_vault_contribution with sourceAccountId when the user says "move X from [account] into [vault]". Unsourced contributions are notional earmarks that don't affect account balances.${contextLine}

When the user asks whether they will hit their savings target this month, call get_forecast for the current month and year. Report the projected savings rate and the top categories pushing it down. Always label the output as a projection from historical data, not a guarantee.
When proposing vault contributions, check get_forecast first. If projectedSavingsRate is below the savingsRateTarget and vsTarget < 0, temper the advice: note that the user is projected to land below target and suggest funding vaults lighter this month.
When dataSufficiency is "thin", stay quiet — acknowledge the projection isn't reliable yet.

Respond in the language the user writes in (Spanish or English).`;

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
            const title = buildProposalTitle(toolBlock.name, toolInput);
            const fields = buildProposalFields(toolInput);

            // Persist a PendingProposal record
            // Cast toolInput to unknown first to satisfy Prisma's Json InputJsonValue type
            const pendingProposal = await db.pendingProposal.create({
              data: {
                action: toolBlock.name,
                params: toolInput as unknown as Record<string, string>,
                title,
                channel,
              },
            });

            const descriptor: ProposalDescriptor = {
              id: pendingProposal.id,
              action: toolBlock.name,
              params: toolInput,
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
