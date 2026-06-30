import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ToolResultBlockParam, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { NextRequest } from "next/server";
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
import type { ChatModuleContext } from "@/components/chat/chat-provider";

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
    default:
      return { error: `Unknown read tool: ${name}` };
  }
}

// ─── Proposal label builder ───────────────────────────────────────────────────

function describeProposal(
  name: string,
  input: Record<string, unknown>,
): string {
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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    content: string;
    context?: ChatModuleContext;
  };
  const { content, context } = body;

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

Respond in the language the user writes in (Spanish or English).`;

  // Persist user message and fetch history in parallel
  const [, historyRows] = await Promise.all([
    saveMessage("user", content),
    db.chatMessage.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const history = historyRows.slice(-20);

  // Build initial messages — history already includes the just-saved user message
  const messages: MessageParam[] = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const write = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };

      try {
        let fullText = "";

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
                const label = describeProposal(toolBlock.name, toolInput);
                write({
                  type: "proposal",
                  action: toolBlock.name,
                  params: toolInput,
                  label,
                });
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

          // end_turn — emit text blocks as NDJSON deltas
          for (const block of res.content) {
            if (block.type === "text") {
              fullText += block.text;
              write({ type: "text", delta: block.text });
            }
          }

          // Persist assistant response
          if (fullText) {
            await saveMessage("assistant", fullText);
          }

          break;
        }

        controller.close();
      } catch (err) {
        write({
          type: "text",
          delta: "Something went wrong. Please try again.",
        });
        controller.close();
        console.error("[chat/route]", err);
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
