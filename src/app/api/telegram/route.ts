// Telegram webhook handler — receives messages and callback_query updates.
//
// Required server-only env vars (never expose to client bundles):
//   TELEGRAM_BOT_TOKEN       — from BotFather
//   TELEGRAM_ALLOWED_CHAT_ID — your numeric chat ID (hard allowlist; one authorized user)
//   TELEGRAM_WEBHOOK_SECRET  — random string; must match the secret_token sent to setWebhook

import { after, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { saveMessage } from "@/lib/actions/chat";
import { runAgentTurn } from "@/lib/agent/run-agent-turn";
import { resolveProposal } from "@/lib/agent/execute-proposal";
import {
  sendMessage,
  sendChatAction,
  answerCallbackQuery,
  editMessageText,
} from "@/lib/telegram/api";
import { toTelegramMessage } from "@/lib/telegram/render";

// ─── Minimal Telegram Update types ───────────────────────────────────────────

type TelegramUser = { id: number; first_name?: string; username?: string };

type TelegramChat = { id: number; type: string };

type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
};

type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

// ─── Idempotency guard ────────────────────────────────────────────────────────
// Module-level variable: dedupe on update_id to avoid double-processing retried updates.
// Sufficient for single-user, single-instance usage.

let lastProcessedUpdateId = -1;

// ─── Webhook handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  // B.5 — Verify webhook secret token
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const update = (await req.json()) as TelegramUpdate;

  // Idempotency: ignore already-processed update_ids
  if (update.update_id <= lastProcessedUpdateId) {
    return new Response("ok", { status: 200 });
  }
  lastProcessedUpdateId = update.update_id;

  // Extract chat_id from either a message or callback_query
  const chatId =
    update.message?.chat?.id ??
    update.callback_query?.message?.chat?.id;

  // B.3 — Hard allowlist: ignore unauthorized senders (return 200, not 4xx, so Telegram doesn't retry)
  if (
    chatId == null ||
    String(chatId) !== process.env.TELEGRAM_ALLOWED_CHAT_ID
  ) {
    return new Response("ok", { status: 200 });
  }

  // B.4 — Acknowledge immediately; do work asynchronously so Telegram doesn't time out
  after(async () => {
    try {
      if (update.message?.text) {
        await handleTextMessage(chatId, update.message.text);
      } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
      }
    } catch (err) {
      console.error("[telegram/route] after() error:", err);
    }
  });

  return new Response("ok", { status: 200 });
}

// ─── Message handler ──────────────────────────────────────────────────────────

async function handleTextMessage(chatId: number, text: string): Promise<void> {
  // Signal typing immediately
  await sendChatAction(chatId, "typing");

  // Load recent shared history (web + telegram)
  const historyRows = await db.chatMessage.findMany({
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  const history = historyRows.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Append the incoming user message to history before passing to agent
  history.push({ role: "user", content: text });

  // Save user message
  await saveMessage("user", text, "telegram");

  // Run agent turn (buffered — no streaming callback for Telegram)
  const result = await runAgentTurn({
    messages: history,
    context: undefined,
    channel: "telegram",
  });

  // Save assistant text
  if (result.text) {
    await saveMessage("assistant", result.text, "telegram");
    await sendMessage(chatId, result.text, { parse_mode: "Markdown" });
  }

  // Send each proposal as a separate message with inline keyboard
  for (const proposal of result.proposals) {
    const { text: proposalText, reply_markup } = toTelegramMessage(proposal);
    await sendMessage(chatId, proposalText, {
      reply_markup,
      parse_mode: "Markdown",
    });
  }
}

// ─── Callback query handler ───────────────────────────────────────────────────

// Actions where an undo button is offered after approval
const REVERSIBLE_ACTIONS = new Set([
  "createInstallment", "markPayment", "createLoan", "recordPayment",
  "createDebtor", "createCard",
]);

async function handleCallbackQuery(cbq: TelegramCallbackQuery): Promise<void> {
  const data = cbq.data ?? "";

  // Handle undo callback: "undo:{proposalId}"
  if (data.startsWith("undo:")) {
    const originalProposalId = data.slice(5);
    await answerCallbackQuery(cbq.id, "Running undo...");

    const chatId = cbq.message?.chat?.id;
    if (chatId == null) return;

    // Trigger the undo proposal directly without needing an agent turn
    const { runAgentTurn } = await import("@/lib/agent/run-agent-turn");
    const undoResult = await runAgentTurn({
      messages: [{ role: "user", content: `Undo the last action (proposal id: ${originalProposalId})` }],
      channel: "telegram",
    });

    // Send the undo proposal card
    for (const proposal of undoResult.proposals) {
      const { toTelegramMessage } = await import("@/lib/telegram/render");
      const { text: proposalText, reply_markup } = toTelegramMessage(proposal);
      await sendMessage(chatId, proposalText, {
        reply_markup,
        parse_mode: "Markdown",
      });
    }
    if (undoResult.text) {
      await sendMessage(chatId, undoResult.text, { parse_mode: "Markdown" });
    }
    return;
  }

  // Format: "{proposalId}:{choiceId}"
  const colonIdx = data.lastIndexOf(":");
  if (colonIdx === -1) {
    await answerCallbackQuery(cbq.id, "Invalid callback data.");
    return;
  }

  const proposalId = data.slice(0, colonIdx);
  const choiceId = data.slice(colonIdx + 1) as "approve" | "dismiss";

  if (choiceId !== "approve" && choiceId !== "dismiss") {
    await answerCallbackQuery(cbq.id, "Unknown action.");
    return;
  }

  const result = await resolveProposal({ proposalId, choiceId });

  await answerCallbackQuery(cbq.id, result.message);

  // Edit the message to reflect the resolved state and remove the buttons
  const chatId = cbq.message?.chat?.id;
  const messageId = cbq.message?.message_id;
  if (chatId != null && messageId != null) {
    const resolvedText = choiceId === "approve" ? "✅ Approved" : "❌ Dismissed";
    await editMessageText(chatId, messageId, resolvedText, { reply_markup: undefined });

    // For approved reversible actions, send a follow-up with an undo button
    if (choiceId === "approve" && result.ok) {
      // Look up the proposal to check its action
      const { db } = await import("@/lib/db");
      const proposal = await db.pendingProposal.findUnique({
        where: { id: proposalId },
        select: { action: true },
      });
      if (proposal && REVERSIBLE_ACTIONS.has(proposal.action)) {
        await sendMessage(chatId, "Action approved.", {
          reply_markup: {
            inline_keyboard: [[
              { text: "↩ Undo", callback_data: `undo:${proposalId}` },
            ]],
          },
        });
      }
    }
  }
}
