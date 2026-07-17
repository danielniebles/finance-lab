// Shared agent-turn + Telegram-delivery helper.
//
// Runs one agent turn on a piece of text, persists it into the shared ChatMessage
// history, and delivers the reply + any proposal cards to the single allowed
// Telegram chat. Both entry points that can trigger an agent turn without a live
// web session — the Telegram webhook and the external ingest endpoint — call this
// so the two channels can never diverge (ADR-028).
//
// Required server-only env var: TELEGRAM_ALLOWED_CHAT_ID (hard allowlist; one
// authorized user — there is only ever one delivery target, so it is resolved
// here rather than threaded through as a parameter).

import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { db } from "@/lib/db";
import { saveMessage } from "@/lib/actions/chat";
import { runAgentTurn } from "@/lib/agent/run-agent-turn";
import { sendMessage, sendChatAction } from "@/lib/telegram/api";
import { toTelegramMessage, toTelegramAutoRecordMessage, toTelegramBatchMessage } from "@/lib/telegram/render";
import { formatCOP } from "@/lib/format";
import type { AgentTurnResult, AutoRecordedNotice, ProposalDescriptor } from "@/lib/agent/types";

// A turn whose only output is a proposal (no text) was previously dropped from
// ChatMessage entirely, so the model couldn't see what it had already proposed
// and re-asked / drifted next turn. Always persist a combined record (ADR-027).

function buildAssistantRecord(
  text: string | undefined,
  proposals: Pick<ProposalDescriptor, "title">[],
): string {
  const proposalSummary = proposals
    .map((p) => `[Proposed: ${p.title} — awaiting your approval]`)
    .join("\n");
  return [text, proposalSummary].filter(Boolean).join("\n\n");
}

// Exported so the Telegram callback-query path (undo) can persist its own
// agent turn through the identical combined text+proposal-summary record,
// without duplicating the history-threading logic (ADR-027).
export async function saveAssistantTurn(
  text: string | undefined,
  proposals: Pick<ProposalDescriptor, "title">[],
  channel: "web" | "telegram" | "shortcut",
): Promise<void> {
  const assistantRecord = buildAssistantRecord(text, proposals);
  if (assistantRecord) {
    await saveMessage("assistant", assistantRecord, channel);
  }
}

// Shared by both the plain-text and image entry points: loads the most
// RECENT 20 messages (desc + take), then reverses back to chronological
// order. `asc + take` would instead grab the 20 OLDEST rows, permanently
// blinding the agent to anything recent once the conversation exceeds 20
// messages (ADR-029). History rows are always plain strings — only the
// incoming message (appended by the caller) may carry a content-block array.
async function loadHistory(): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const historyRows = (
    await db.chatMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    })
  ).reverse();

  return historyRows.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}

async function loadHistoryWithIncoming(
  text: string,
): Promise<{ role: "user" | "assistant"; content: MessageParam["content"] }[]> {
  const history = await loadHistory();
  return [...history, { role: "user" as const, content: text }];
}

// ─── Auto-record notification (ADR-033) ──────────────────────────────────────
// The tool-use loop only returns proposalId/transactionId (AutoRecordedNotice)
// — it doesn't know about Telegram rendering. This loads the already-approved
// PendingProposal row (created by auto-record-transaction.ts, complete with
// its `editable` category field) and the rule that matched, to build the
// "✅ Recorded…" notification with the reused eopen:/undo: callback formats.

async function sendAutoRecordNotification(chatId: string, notice: AutoRecordedNotice): Promise<void> {
  const proposal = await db.pendingProposal.findUnique({ where: { id: notice.proposalId } });
  if (!proposal) return;

  const params = proposal.params as {
    amount: number;
    appCategoryId: string;
    wallet: string;
    ruleMatchType?: string;
    ruleMatchValue?: string;
  };
  const editable = proposal.editable as { options: { id: string; label: string }[] }[] | null;
  const categoryName =
    editable?.[0]?.options.find((o) => o.id === params.appCategoryId)?.label ?? "?";

  const { text, reply_markup } = toTelegramAutoRecordMessage({
    proposalId: notice.proposalId,
    amountText: formatCOP(params.amount),
    appCategoryName: categoryName,
    wallet: params.wallet,
    ruleMatchType: params.ruleMatchType ?? "?",
    ruleMatchValue: params.ruleMatchValue ?? "?",
  });

  await sendMessage(chatId, text, { reply_markup, parse_mode: "HTML" });
}

// Shared tail for both entry points: persists the combined assistant turn,
// then delivers text/proposal cards/auto-record notices to Telegram exactly
// the same way regardless of whether the turn started from text or an image.
async function deliverResultToTelegram(
  chatId: string,
  channel: "web" | "telegram" | "shortcut",
  result: AgentTurnResult,
): Promise<void> {
  await saveAssistantTurn(result.text, result.proposals, channel);

  if (result.text) {
    await sendMessage(chatId, result.text);
  }

  for (const proposal of result.proposals) {
    const { text: proposalText, reply_markup } = proposal.batch
      ? toTelegramBatchMessage(proposal)
      : toTelegramMessage(proposal);
    await sendMessage(chatId, proposalText, {
      reply_markup,
      parse_mode: "HTML",
    });
  }

  // result.autoRecorded may be absent on older/mocked results (tests mock
  // runAgentTurn's return shape) — default defensively rather than assume.
  for (const notice of result.autoRecorded ?? []) {
    await sendAutoRecordNotification(chatId, notice);
  }
}

/**
 * Runs one agent turn on `text`, sends the reply + proposal cards to the
 * Telegram chat, and persists a coherent assistant turn (incl. proposal
 * summary) to the shared ChatMessage history.
 */
export async function runTurnAndDeliverToTelegram(
  text: string,
  opts?: { channel?: "web" | "telegram" | "shortcut" },
): Promise<void> {
  const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID as string;
  const channel = opts?.channel ?? "shortcut";

  if (channel === "telegram") {
    await sendChatAction(chatId, "typing");
  }

  // Ingested (shortcut) messages arrive with no visible trace in Telegram —
  // echo the raw text before running the turn so the user can see exactly
  // what's being processed and match it to the reply that follows. Normal
  // Telegram messages are already visible in the chat; don't double-echo.
  if (channel === "shortcut") {
    await sendMessage(chatId, `📥 Processing: ${text}`);
  }

  const history = await loadHistoryWithIncoming(text);
  await saveMessage("user", text, channel);

  // Run agent turn (buffered — no streaming callback). Delivery is always
  // Telegram regardless of entry point, so this is always tagged "telegram".
  const result = await runAgentTurn({
    messages: history,
    context: undefined,
    channel: "telegram",
  });

  await deliverResultToTelegram(chatId, channel, result);
}

/**
 * Image-aware sibling of `runTurnAndDeliverToTelegram()` (Part 1 of the
 * card-screenshot feature — see .scratch/card-screenshot-image-ingestion.md).
 * Only the Telegram photo path calls this today: a photo arrives with no
 * caption text worth persisting verbatim, so a short placeholder is saved to
 * `ChatMessage` instead of the raw image bytes (never store base64 in the
 * DB — `ChatMessage.content` stays a plain `String` column, no schema change).
 * The image content block is attached ONLY to the live incoming message;
 * history rows loaded from the DB are always plain strings.
 */
export async function runImageTurnAndDeliverToTelegram(
  image: { base64: string; mediaType: string },
  opts?: { channel?: "telegram"; instruction?: string },
): Promise<void> {
  const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID as string;
  const channel = opts?.channel ?? "telegram";
  const instruction = opts?.instruction ?? "Extract the information from this image.";

  await sendMessage(chatId, "📸 Reading the screenshot…");

  const history = await loadHistory();
  // Placeholder text for shared history — never persist raw image bytes.
  await saveMessage("user", "📸 [card photo received]", channel);

  const incomingMessage: { role: "user"; content: MessageParam["content"] } = {
    role: "user",
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: image.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: image.base64 },
      },
      { type: "text", text: instruction },
    ],
  };

  const result = await runAgentTurn({
    messages: [...history, incomingMessage],
    context: undefined,
    channel: "telegram",
  });

  await deliverResultToTelegram(chatId, channel, result);
}
