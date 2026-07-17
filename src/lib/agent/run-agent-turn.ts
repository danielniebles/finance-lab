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
import type { AgentTurnResult, AutoRecordedNotice, BatchDescriptor, ProposalDescriptor } from "./types";
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
  autoRecorded: AutoRecordedNotice[],
): Promise<ToolResultBlockParam> {
  // Run complex resolution (name lookups, previews) for new tools
  const resolved = await resolveComplexProposal(toolBlock.name, toolInput, channel);

  // If resolution produced a blocking message, return it as an error result
  if (resolved?.blockingMessage) {
    return {
      type: "tool_result",
      tool_use_id: toolBlock.id,
      content: resolved.blockingMessage,
      is_error: true,
    };
  }

  // Counterparty-rule auto-record (ADR-033): the resolver already performed
  // the write (createTransaction + rule bump + an already-approved
  // PendingProposal). Short-circuit — no normal card, no second proposal row.
  if (resolved?.autoRecorded) {
    autoRecorded.push({
      proposalId: resolved.autoRecorded.proposalId,
      transactionId: resolved.autoRecorded.transactionId,
    });
    return {
      type: "tool_result",
      tool_use_id: toolBlock.id,
      content: resolved.autoRecorded.message,
    };
  }

  // Build final params, title, fields, editable
  const finalParams = resolved ? resolved.params : toolInput;
  const title = resolved ? resolved.title : buildProposalTitle(toolBlock.name, toolInput);
  const fields = resolved ? resolved.fields : buildProposalFields(toolInput);
  const editable = resolved?.editable;
  // propose_add_transactions_batch (ADR-034) nests its multi-item shape
  // under params.batch — the single source of truth PendingProposal.params
  // persists and every batch callback (bt:/be:/bs:/bc:) later reads/mutates.
  // Thread it onto the descriptor too so the immediate NDJSON/Telegram
  // render has it without a second DB read.
  const batch = (finalParams as { batch?: BatchDescriptor }).batch;

  // Store the verbatim tool name — no transformation. This is the
  // canonical action identifier across PendingProposal.action, the
  // registry, and undo. (ADR-026)
  const actionName = toolBlock.name;

  // Persist a PendingProposal record. `editable` is stored at creation time
  // (not just mutated later) so the Telegram/web edit callbacks can resolve
  // option index → id without re-running the agent (ADR-031).
  const pendingProposal = await db.pendingProposal.create({
    data: {
      action: actionName,
      params: finalParams as unknown as Record<string, string>,
      title,
      channel,
      ...(editable ? { editable: editable as unknown as Record<string, string> } : {}),
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
    ...(editable ? { editable } : {}),
    ...(batch ? { batch } : {}),
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
  autoRecorded: AutoRecordedNotice[],
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
      toolResults.push(
        await processProposalToolBlock(toolBlock, toolInput, channel, proposals, autoRecorded),
      );
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

export function deduplicateHistory<T extends { role: "user" | "assistant" }>(
  inputMessages: T[],
): T[] {
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

// A model turn can end on plain text (stop_reason "end_turn", no tool_use
// block at all) yet still use action-claiming language it picked up from its
// own prior turns in history (e.g. "drafted for your approval") — nothing
// else in the loop distinguishes that from a REAL proposal. This is a
// defensive backstop for exactly that mismatch: text that CLAIMS a proposal
// exists while zero proposals/auto-records were actually produced this turn.
// Kept as a plain substring/regex check (not asking the model to self-report)
// since the whole point is not to trust the model's own claim.
const FALSE_PROPOSAL_CLAIM_RE = /drafted for your approval|awaiting your approval|proposed:/i;

// Same failure class, different surface: a CounterpartyRule auto-record
// (ADR-033) confirmation. Confirmed in production (2026-07-17): 5 identical-
// looking bank notifications for the same merchant matched an autoRecord
// rule, but only 2 actually produced a PendingProposal + Transaction — the
// other 3 got a confident "✅ Registered automatically per your rule..."
// reply with ZERO propose_add_transaction tool call that turn. The model
// pattern-matched its own prior auto-record confirmations from history
// instead of re-calling the tool for a genuinely distinct transaction.
// FALSE_PROPOSAL_CLAIM_RE never matched this phrasing at all (it's free
// text from prompt.ts's instructions, not the drafted-card template), so
// the claim sailed through undetected.
//
// A first fix widened this to a broad "recorded automatically"/"registered
// automatically" catch-all, but a follow-up code-review pass caught that
// this also matches a model TRUTHFULLY describing a PAST auto-record on a
// pure read/Q&A turn ("Yes, it was recorded automatically per your rule
// earlier" — zero tool calls, actionsTakenCount 0, a legitimate answer) —
// that true statement was silently replaced with a false failure message.
// prompt.ts now canonicalizes ONE fixed phrase — "recorded automatically
// per your rule just now" — for the live-confirmation moment only, and
// steers the model toward different, clearly retrospective wording for
// past auto-records. This regex was narrowed to match only that canonical
// phrase, so the surface area is fixed and small instead of open-ended
// natural language. "registrado automáticamente" stays broad as defense-
// in-depth against any already-in-flight Spanish history predating the
// language switch — it is not reachable by live English replies anymore.
const FALSE_AUTO_RECORD_CLAIM_RE = /recorded automatically per your rule just now|registrado autom[aá]ticamente/i;

export function isUnbackedProposalClaim(text: string, actionsTakenCount: number): boolean {
  return (
    actionsTakenCount === 0 &&
    (FALSE_PROPOSAL_CLAIM_RE.test(text) || FALSE_AUTO_RECORD_CLAIM_RE.test(text))
  );
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
  messages: { role: "user" | "assistant"; content: MessageParam["content"] }[];
  context?: { module?: string; focus?: { month: number; year: number }; entityId?: string; route?: string };
  onTextDelta?: (delta: string) => void;
  channel?: "web" | "telegram";
}): Promise<AgentTurnResult> {
  const { messages: inputMessages, context, onTextDelta, channel = "web" } = args;

  const now = new Date();
  const systemPrompt = buildSystemPrompt({ now, context });

  // Guard against orphaned consecutive user messages.
  // Keep the most recent user message; strip extra trailing user messages.
  // History rows loaded from the DB are always plain strings — only the LIVE
  // incoming message (the last one) may carry an Anthropic content-block array
  // (e.g. an image block from a Telegram photo). deduplicateHistory only reads
  // `.role`, so it's unaffected by the widened content type.
  const history = deduplicateHistory(inputMessages);

  const messages: MessageParam[] = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const proposals: ProposalDescriptor[] = [];
  const autoRecorded: AutoRecordedNotice[] = [];
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
        const { toolResults, lastTool: lt } = await processToolUseBlocks(
          res.content,
          channel,
          proposals,
          autoRecorded,
        );
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

  // Backstop against a phantom "success" reply (see isUnbackedProposalClaim
  // above): if the model's final text claims a drafted/proposed action but
  // this turn produced zero real proposals or auto-records, the claim is
  // false — replace it so neither the user nor the persisted ChatMessage
  // history ever records an action that didn't happen.
  if (isUnbackedProposalClaim(fullText, proposals.length + autoRecorded.length)) {
    console.error("[run-agent-turn] Model claimed a drafted proposal with no backing tool call:", {
      fullText,
      historyLength: history.length,
      lastTool,
    });
    fullText = "Something went wrong drafting that — nothing was recorded. Please try again.";
  }

  return { text: fullText, proposals, autoRecorded };
}
