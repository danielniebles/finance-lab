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
import { logEvent, type ChatRole } from "./events";

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

/**
 * Guards against orphaned consecutive user messages: keeps the most recent
 * one and drops the earlier ones in the same trailing run.
 *
 * Event turns in that run are always preserved — they are the system's record
 * of what happened (see events.ts), and a run of them typically sits right
 * before the live user message (proposal_created → approved → rule_offer →
 * next bank notification). Dropping them would blind the model to reality at
 * exactly the moment it matters most.
 */
export function deduplicateHistory<T extends { role: ChatRole }>(inputMessages: T[]): T[] {
  const history = [...inputMessages];

  // Walk back over the trailing non-assistant run.
  let runStart = history.length;
  while (runStart > 0 && history[runStart - 1].role !== "assistant") runStart--;

  const tail = history.slice(runStart);
  const userTurns = tail.filter((turn) => turn.role === "user");
  if (userTurns.length <= 1) return history;

  const liveUserTurn = userTurns[userTurns.length - 1];
  const kept = tail.filter((turn) => turn.role !== "user" || turn === liveUserTurn);
  return [...history.slice(0, runStart), ...kept];
}

/** Joins two message contents, preserving block arrays (e.g. an image turn). */
function joinContent(
  left: MessageParam["content"],
  right: MessageParam["content"],
): MessageParam["content"] {
  if (typeof left === "string" && typeof right === "string") {
    return `${left}\n\n${right}`;
  }
  const toBlocks = (content: MessageParam["content"]) =>
    typeof content === "string" ? [{ type: "text" as const, text: content }] : content;
  return [...toBlocks(left), ...toBlocks(right)];
}

/**
 * Maps history turns onto the Anthropic message list.
 *
 * Event turns are folded into the adjacent user turn rather than sent as
 * messages of their own: an event is an observation given TO the model, so it
 * belongs on the user side — `assistant` is precisely the mislabel this whole
 * mechanism exists to fix. Merging (rather than emitting consecutive user
 * messages) also keeps the transcript strictly alternating.
 */
export function toMessageParams(
  turns: { role: ChatRole; content: MessageParam["content"] }[],
): MessageParam[] {
  const messages: MessageParam[] = [];

  for (const turn of turns) {
    const role = turn.role === "assistant" ? "assistant" : "user";
    const previous = messages[messages.length - 1];
    if (previous && previous.role === role && role === "user") {
      previous.content = joinContent(previous.content, turn.content);
      continue;
    }
    messages.push({ role, content: turn.content });
  }

  return messages;
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

// ─── Learn-rule nudge stripping ──────────────────────────────────────────────
// execute-proposal.ts's buildLearnRuleNudge is the ONLY legitimate emitter of
// the "💡 Want me to remember this?" offer, and it fires strictly AFTER the
// user approves a transaction. Since b664294 that text is persisted with role
// "assistant" (telegram/route.ts, so a later "yes" has context to read) — and
// ChatMessage has no provenance column, so the next turn replays it to the
// model as its OWN words. The model then paraphrases it into the DRAFT reply,
// before any approval exists. Observed in production 2026-09-01: a drafted
// card carried "💡 Want me to remember this? I can create a rule for
// GOOGLE *Workspace_lila…" — wording that is nowhere in buildLearnRuleNudge.
//
// Two real consequences, not just noise: the user gets the same offer twice
// (once pre-approval, once post-approval), and a "yes" to the premature copy
// would create a CounterpartyRule for a transaction that was never approved
// (that card was in fact dismissed).
//
// prompt.ts now forbids writing the nudge; this strips it as the mechanical
// backstop. The genuine nudge never flows through here — it is sent directly
// from the Telegram callback handler — so nothing legitimate is at risk.
// Matches only the OFFER form, never a user's own "yes, remember it" being
// quoted back in an acknowledgement.
const MODEL_NUDGE_RE = /want me to remember this|tell me ["“']?yes,? remember it/i;

/**
 * Cuts the offer out of one paragraph. Prefers trimming from the start of the
 * sentence carrying it (usually a "💡 " lead-in) rather than dropping the
 * whole paragraph, which may also hold the legitimate drafted-card summary.
 */
function stripNudgeFromParagraph(paragraph: string): string {
  const match = MODEL_NUDGE_RE.exec(paragraph);
  if (!match) return paragraph;
  const head = paragraph.slice(0, match.index);
  const cutAt = Math.max(head.lastIndexOf("💡"), head.lastIndexOf("\n"), head.lastIndexOf(". ") + 1);
  return cutAt > 0 ? paragraph.slice(0, cutAt).trim() : "";
}

export function stripLearnRuleNudge(text: string): string {
  if (!text) return text;
  return text
    .split(/\n{2,}/)
    .map(stripNudgeFromParagraph)
    .filter((paragraph) => paragraph.length > 0)
    .join("\n\n")
    .trim();
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

// ─── Tool-use loop ───────────────────────────────────────────────────────────

type ToolLoopArgs = {
  systemPrompt: string;
  /** Mutated in place as the loop appends assistant/tool_result turns. */
  messages: MessageParam[];
  channel: string;
  proposals: ProposalDescriptor[];
  autoRecorded: AutoRecordedNotice[];
  onTextDelta?: (delta: string) => void;
  /**
   * Sends `tool_choice: {type:"any"}` on the FIRST model call only, making a
   * tool call mandatory instead of merely encouraged.
   *
   * Why the first call only: forcing it on every iteration makes end_turn
   * unreachable and the loop never terminates. One forced call is enough —
   * it removes the specific failure mode where the model answers a machine-
   * forwarded bank notification with prose alone (see the unbacked-claim
   * backstop below), while leaving it free to end the turn normally after
   * whatever tool it picks.
   *
   * Only safe for inputs whose turn is definitionally a tool call. A
   * forwarded bank notification qualifies: prompt.ts already states such a
   * message is self-contained and must produce exactly one card, with the
   * category edited on the card rather than asked about. Do NOT set this for
   * free-form chat, where "thanks" or a follow-up question would be forced
   * into a spurious tool call.
   */
  forceInitialToolUse?: boolean;
};

async function runToolLoop(args: ToolLoopArgs): Promise<{ text: string; lastTool: string | null }> {
  const { systemPrompt, messages, channel, proposals, autoRecorded, onTextDelta } = args;
  let text = "";
  let lastTool: string | null = null;
  let iteration = 0;

  while (true) {
    const forceToolUse = args.forceInitialToolUse === true && iteration === 0;
    iteration++;

    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      tools: TOOLS,
      ...(forceToolUse ? { tool_choice: { type: "any" as const } } : {}),
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
    text += collectTextBlocks(res.content, onTextDelta);
    return { text, lastTool };
  }
}

// ─── Channel-agnostic agent turn ─────────────────────────────────────────────

const UNBACKED_CLAIM_MESSAGE =
  "Something went wrong drafting that — nothing was recorded. Please try again.";

export async function runAgentTurn(args: {
  messages: { role: ChatRole; content: MessageParam["content"] }[];
  context?: { module?: string; focus?: { month: number; year: number }; entityId?: string; route?: string };
  onTextDelta?: (delta: string) => void;
  channel?: "web" | "telegram";
  /** See ToolLoopArgs.forceInitialToolUse — set for machine-forwarded input only. */
  forceInitialToolUse?: boolean;
}): Promise<AgentTurnResult> {
  const { messages: inputMessages, context, onTextDelta, channel = "web", forceInitialToolUse } = args;

  const now = new Date();
  const systemPrompt = buildSystemPrompt({ now, context });

  // Guard against orphaned consecutive user messages.
  // Keep the most recent user message; strip extra trailing user messages.
  // History rows loaded from the DB are always plain strings — only the LIVE
  // incoming message (the last one) may carry an Anthropic content-block array
  // (e.g. an image block from a Telegram photo). deduplicateHistory only reads
  // `.role`, so it's unaffected by the widened content type.
  const history = deduplicateHistory(inputMessages);

  // Rebuilt (not reused) per attempt: runToolLoop mutates its array, so a
  // retry must start from clean history rather than from a transcript that
  // already contains the failed attempt's phantom assistant turn.
  const buildMessages = (): MessageParam[] => toMessageParams(history);

  const proposals: ProposalDescriptor[] = [];
  const autoRecorded: AutoRecordedNotice[] = [];
  let fullText = "";
  let lastTool: string | null = null;
  let unbackedClaim: { recovered: boolean } | undefined;

  try {
    const attempt = await runToolLoop({
      systemPrompt,
      messages: buildMessages(),
      channel,
      proposals,
      autoRecorded,
      onTextDelta,
      forceInitialToolUse,
    });
    fullText = attempt.text;
    lastTool = attempt.lastTool;

    // Backstop against a phantom "success" reply (see isUnbackedProposalClaim
    // above): if the model's final text claims a drafted/proposed action but
    // this turn produced zero real proposals or auto-records, the claim is
    // false — nothing was persisted.
    if (isUnbackedProposalClaim(fullText, proposals.length + autoRecorded.length)) {
      // Captured before the retry overwrites it — this string is the whole
      // point of the audit row below, and it exists nowhere else.
      const phantomText = fullText;
      console.error("[run-agent-turn] Model claimed a drafted proposal with no backing tool call:", {
        fullText,
        historyLength: history.length,
        lastTool,
      });

      // Retry once with the tool call forced, instead of surfacing a failure
      // the user often cannot act on: ingested bank notifications arrive from
      // an iPhone Shortcut, so "please try again" asks for a re-forward the
      // user has no easy way to perform. Both arrays are empty by definition
      // here (actionsTakenCount === 0), so reusing them is safe.
      //
      // Skipped when streaming (onTextDelta, i.e. the web chat): the phantom
      // text has already been written to the client, and a second pass would
      // stream a contradictory reply on top of it. Web keeps today's behavior;
      // Telegram and ingest — the channels where this actually fires — are
      // buffered and get the retry.
      if (!onTextDelta) {
        const retry = await runToolLoop({
          systemPrompt,
          messages: buildMessages(),
          channel,
          proposals,
          autoRecorded,
          forceInitialToolUse: true,
        });
        fullText = retry.text;
        lastTool = retry.lastTool ?? lastTool;
      }

      // Still unbacked after the retry (or streaming, where no retry ran):
      // replace the claim so neither the user nor the persisted ChatMessage
      // history ever records an action that didn't happen.
      const recovered = !isUnbackedProposalClaim(
        fullText,
        proposals.length + autoRecorded.length,
      );

      // Persist the anomaly, phantom text included. Vercel Hobby keeps runtime
      // logs ~1h while detection latency here is hours (the user finds out
      // when they next open Telegram) — an observability channel that expires
      // before anyone looks is not observability. The 2026-09-02 phantom text
      // is unrecoverable for exactly that reason. Never replayed to the model
      // (see NON_REPLAYED_EVENTS in events.ts).
      await logEvent(
        "unbacked_claim",
        { retried: !onTextDelta, recovered, lastTool, text: phantomText },
        channel,
      );
      unbackedClaim = { recovered };

      if (!recovered) {
        console.error("[run-agent-turn] Unbacked proposal claim survived the forced-tool retry:", {
          fullText,
          retried: !onTextDelta,
        });
        fullText = UNBACKED_CLAIM_MESSAGE;
      }
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

  return {
    text: stripLearnRuleNudge(fullText),
    proposals,
    autoRecorded,
    ...(unbackedClaim ? { unbackedClaim } : {}),
  };
}
