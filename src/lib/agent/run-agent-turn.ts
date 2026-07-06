// Channel-agnostic agent turn orchestrator. Owns the Anthropic tool-use
// loop: dispatches tool_use blocks to read-tools.ts / proposals/, persists
// PendingProposal rows, and drives the loop to end_turn.
//
// Split out of the former god-file (see docs/backlog.md) into:
//   read-tools.ts     — read-tool dispatch registry
//   proposals/         — complex proposal resolvers + dispatch registry
//   formatting.ts      — proposal title/field formatting
//   tools.ts           — TOOLS JSON schema array
// This file keeps the orchestration: the tool-use loop, tool-block
// processors, and the small pure helpers (deduplicateHistory,
// collectTextBlocks) that only that loop needs.

import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ToolResultBlockParam, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { db } from "@/lib/db";
import { saveMessage } from "@/lib/actions/chat";
import type { AgentTurnResult, ProposalDescriptor } from "./types";
import { buildSystemPrompt } from "./prompt";
import { PROPOSAL_ACTIONS } from "./actions";
import { TOOLS } from "./tools";
import { READ_TOOLS, runReadTool } from "./read-tools";
import { buildProposalTitle, buildProposalFields } from "./formatting";
import { resolveComplexProposal } from "./proposals";

const anthropic = new Anthropic();

// Derived from the registry so it can never drift. propose_undo_last is handled
// specially in the executor (consumes the registry, not a direct entry) but is
// still a recognized proposal tool that persists a PendingProposal row.
const PROPOSAL_TOOLS = new Set([
  ...Object.keys(PROPOSAL_ACTIONS),
  "propose_undo_last",
]);

// ─── Tool block processors ────────────────────────────────────────────────────

async function processReadToolBlock(
  toolBlock: ToolUseBlock,
  toolInput: Record<string, unknown>,
): Promise<ToolResultBlockParam> {
  try {
    const data = await runReadTool(toolBlock.name, toolInput);
    return {
      type: "tool_result",
      tool_use_id: toolBlock.id,
      content: JSON.stringify(data),
    };
  } catch (err) {
    return {
      type: "tool_result",
      tool_use_id: toolBlock.id,
      content: `Error executing tool: ${err instanceof Error ? err.message : String(err)}`,
      is_error: true,
    };
  }
}

async function processProposalToolBlock(
  toolBlock: ToolUseBlock,
  toolInput: Record<string, unknown>,
  channel: string,
  proposals: ProposalDescriptor[],
): Promise<ToolResultBlockParam> {
  // Run complex resolution (name lookups, previews) for new tools
  const resolved = await resolveComplexProposal(toolBlock.name, toolInput);

  // If resolution produced a blocking message, return it as an error result
  if (resolved?.blockingMessage) {
    return {
      type: "tool_result",
      tool_use_id: toolBlock.id,
      content: resolved.blockingMessage,
      is_error: true,
    };
  }

  // Build final params, title, fields
  const finalParams = resolved ? resolved.params : toolInput;
  const title = resolved ? resolved.title : buildProposalTitle(toolBlock.name, toolInput);
  const fields = resolved ? resolved.fields : buildProposalFields(toolInput);

  // Store the verbatim tool name — no transformation. This is the
  // canonical action identifier across PendingProposal.action, the
  // registry, and undo. (ADR-026)
  const actionName = toolBlock.name;

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

  return {
    type: "tool_result",
    tool_use_id: toolBlock.id,
    content: "Proposal surfaced to the user for approval.",
  };
}

async function processToolUseBlocks(
  blocks: Anthropic.Messages.ContentBlock[],
  channel: string,
  proposals: ProposalDescriptor[],
): Promise<{ toolResults: ToolResultBlockParam[]; lastTool: string | null }> {
  const toolResults: ToolResultBlockParam[] = [];
  let lastTool: string | null = null;

  for (const block of blocks) {
    if (block.type !== "tool_use") continue;
    const toolBlock = block as ToolUseBlock;
    const toolInput = toolBlock.input as Record<string, unknown>;

    if (READ_TOOLS.has(toolBlock.name)) {
      lastTool = toolBlock.name;
      toolResults.push(await processReadToolBlock(toolBlock, toolInput));
    } else if (PROPOSAL_TOOLS.has(toolBlock.name)) {
      lastTool = toolBlock.name;
      toolResults.push(await processProposalToolBlock(toolBlock, toolInput, channel, proposals));
    } else {
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolBlock.id,
        content: `Unknown tool: ${toolBlock.name}`,
        is_error: true,
      });
    }
  }

  return { toolResults, lastTool };
}

export function deduplicateHistory(
  inputMessages: { role: "user" | "assistant"; content: string }[],
): { role: "user" | "assistant"; content: string }[] {
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
  return history;
}

export function collectTextBlocks(
  blocks: Anthropic.Messages.ContentBlock[],
  onTextDelta?: (delta: string) => void,
): string {
  let text = "";
  for (const block of blocks) {
    if (block.type === "text") {
      text += block.text;
      if (onTextDelta) onTextDelta(block.text);
    }
  }
  return text;
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
  const history = deduplicateHistory(inputMessages);

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
        const { toolResults, lastTool: lt } = await processToolUseBlocks(res.content, channel, proposals);
        lastTool = lt ?? lastTool;
        messages.push({ role: "assistant", content: res.content });
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // end_turn — collect text blocks
      fullText += collectTextBlocks(res.content, onTextDelta);
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
