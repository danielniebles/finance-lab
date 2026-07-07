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

import { db } from "@/lib/db";
import { saveMessage } from "@/lib/actions/chat";
import { runAgentTurn } from "@/lib/agent/run-agent-turn";
import { sendMessage, sendChatAction } from "@/lib/telegram/api";
import { toTelegramMessage, toTelegramAutoRecordMessage } from "@/lib/telegram/render";
import { formatCOP } from "@/lib/format";
import type { AutoRecordedNotice, ProposalDescriptor } from "@/lib/agent/types";

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

async function loadHistoryWithIncoming(text: string) {
  // Fetch the most RECENT 20 messages (desc + take), then reverse back to
  // chronological order. `asc + take` would instead grab the 20 OLDEST rows,
  // permanently blinding the agent to anything recent once the conversation
  // exceeds 20 messages (ADR-029).
  const historyRows = (
    await db.chatMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    })
  ).reverse();

  const history = historyRows.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  history.push({ role: "user" as const, content: text });
  return history;
}

// ─── Auto-record notification (ADR-033) ──────────────────────────────────────
// The tool-use loop only returns proposalId/transactionId (AutoRecordedNotice)
// — it doesn't know about Telegram rendering. This loads the already-approved
// PendingProposal row (created by auto-record-transaction.ts, complete with
// its `editable` category field) and the rule that matched, to build the
// "✅ Registrado…" notification with the reused eopen:/undo: callback formats.

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
    await sendMessage(chatId, `📥 Procesando: ${text}`);
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

  await saveAssistantTurn(result.text, result.proposals, channel);

  if (result.text) {
    await sendMessage(chatId, result.text);
  }

  for (const proposal of result.proposals) {
    const { text: proposalText, reply_markup } = toTelegramMessage(proposal);
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
