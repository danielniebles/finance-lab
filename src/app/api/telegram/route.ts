// Telegram webhook handler — receives messages and callback_query updates.
//
// Required server-only env vars (never expose to client bundles):
//   TELEGRAM_BOT_TOKEN       — from BotFather
//   TELEGRAM_ALLOWED_CHAT_ID — your numeric chat ID (hard allowlist; one authorized user)
//   TELEGRAM_WEBHOOK_SECRET  — random string; must match the secret_token sent to setWebhook

import { after, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { runAgentTurn } from "@/lib/agent/run-agent-turn";
import {
  runTurnAndDeliverToTelegram,
  runImageTurnAndDeliverToTelegram,
  saveAssistantTurn,
} from "@/lib/agent/deliver-to-telegram";
import { resolveProposal } from "@/lib/agent/execute-proposal";
import { applyProposalEdit } from "@/lib/agent/apply-proposal-edit";
import {
  toggleBatchItem,
  setBatchItemCategory,
  setBatchCardLabel,
} from "@/lib/agent/apply-batch-edit";
import {
  sendMessage,
  answerCallbackQuery,
  editMessageText,
  getFile,
  downloadFile,
} from "@/lib/telegram/api";
import {
  toTelegramMessage,
  toTelegramEditOptionsMessage,
  toTelegramAutoRecordMessage,
  toTelegramBatchMessage,
  toTelegramBatchCategoryMessage,
  toTelegramBatchCardLabelMessage,
} from "@/lib/telegram/render";
import { formatCOP } from "@/lib/format";
import { REVERSIBLE_ACTIONS } from "@/lib/agent/actions";
import type { ProposalDescriptor, EditableField, BatchDescriptor } from "@/lib/agent/types";

// ─── Minimal Telegram Update types ───────────────────────────────────────────

type TelegramUser = { id: number; first_name?: string; username?: string };

type TelegramChat = { id: number; type: string };

// Telegram's PhotoSize[]: several resolutions of the same photo, always
// ordered smallest → largest. Only file_id/width/height/file_size are used.
type TelegramPhotoSize = { file_id: string; file_size?: number; width: number; height: number };

type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  photo?: TelegramPhotoSize[];
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

const PROPOSAL_NOT_FOUND_MSG = "Proposal not found.";

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
      if (update.message?.photo) {
        await handlePhotoMessage(update.message.photo);
      } else if (update.message?.text) {
        await handleTextMessage(update.message.text);
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
// Thin wrapper: the shared helper does history load, saveMessage, runAgentTurn,
// and delivery (ADR-028). Delivery is always Telegram — chatId is always equal
// to TELEGRAM_ALLOWED_CHAT_ID by construction (the allowlist check already ran
// in POST() before this is ever called), so the helper resolves it internally.

async function handleTextMessage(text: string): Promise<void> {
  await runTurnAndDeliverToTelegram(text, { channel: "telegram" });
}

// ─── Photo message handler (card-screenshot ingestion, Part 1) ───────────────
// Telegram sends several resolutions of the same photo, always ordered
// smallest → largest — take the last (largest) for the best OCR/vision read.
// Resolving bytes is a two-hop fetch (getFile → file_path → file host); on
// any failure, tell the user rather than silently dropping the photo.

async function handlePhotoMessage(photo: TelegramPhotoSize[]): Promise<void> {
  const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID as string;
  const largest = photo[photo.length - 1];

  const filePath = await getFile(largest.file_id);
  if (!filePath) {
    await sendMessage(chatId, "No pude descargar la imagen. Intenta enviarla de nuevo.");
    return;
  }

  const downloaded = await downloadFile(filePath);
  if (!downloaded) {
    await sendMessage(chatId, "No pude descargar la imagen. Intenta enviarla de nuevo.");
    return;
  }

  await runImageTurnAndDeliverToTelegram(downloaded, { channel: "telegram" });
}

// ─── Callback query handler ───────────────────────────────────────────────────

// Actions where an undo button is offered after approval — sourced from the registry (ADR-026).

async function handleUndoCallback(cbq: TelegramCallbackQuery, originalProposalId: string): Promise<void> {
  await answerCallbackQuery(cbq.id, "Running undo...");

  const chatId = cbq.message?.chat?.id;
  if (chatId == null) return;

  // Trigger the undo proposal directly without needing an agent turn
  const undoResult = await runAgentTurn({
    messages: [{ role: "user", content: `Undo the last action (proposal id: ${originalProposalId})` }],
    channel: "telegram",
  });

  // Persist this turn too — same combined text+proposal-summary record as
  // the main text-message path, so an undo turn threads into history.
  await saveAssistantTurn(undoResult.text, undoResult.proposals, "telegram");

  // Send the undo proposal card
  for (const proposal of undoResult.proposals) {
    const { text: proposalText, reply_markup } = toTelegramMessage(proposal);
    await sendMessage(chatId, proposalText, {
      reply_markup,
      parse_mode: "HTML",
    });
  }
  if (undoResult.text) {
    await sendMessage(chatId, undoResult.text);
  }
}

/** After an approved reversible action, send a follow-up message with an ↩ Undo button. */
async function sendUndoButtonIfReversible(chatId: number, proposalId: string): Promise<void> {
  const proposal = await db.pendingProposal.findUnique({
    where: { id: proposalId },
    select: { action: true },
  });
  if (proposal && REVERSIBLE_ACTIONS.includes(proposal.action)) {
    await sendMessage(chatId, "Action approved.", {
      reply_markup: {
        inline_keyboard: [[
          { text: "↩ Undo", callback_data: `undo:${proposalId}` },
        ]],
      },
    });
  }
}

// ─── Editable-field callbacks (ADR-031) ───────────────────────────────────────
// `e:{fieldIdx}:{optIdx}` mutates the pending proposal's params/editable and
// re-renders the default card — it does NOT approve. `eopen:{fieldIdx}` is
// read-only navigation: reveals the option buttons for one field, built from
// the already-persisted `editable[fieldIdx].options` (no DB mutation, no
// re-running the agent). `eback` restores the default card view.

async function loadProposalDescriptor(proposalId: string): Promise<ProposalDescriptor | null> {
  const proposal = await db.pendingProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) return null;

  const params = proposal.params as Record<string, unknown>;

  return {
    id: proposal.id,
    action: proposal.action,
    params,
    title: proposal.title,
    fields: [],
    reasoning: "",
    choices: [
      { id: "approve", label: "Approve", style: "primary" },
      { id: "dismiss", label: "Dismiss" },
    ],
    editable: (proposal.editable as unknown as EditableField[] | null) ?? undefined,
    batch: (params.batch as BatchDescriptor | undefined) ?? undefined,
  };
}

async function editMessageWithProposal(
  chatId: number,
  messageId: number,
  proposal: ProposalDescriptor,
  view: "card" | { fieldIdx: number },
): Promise<void> {
  const { text, reply_markup } =
    view === "card" ? toTelegramMessage(proposal) : toTelegramEditOptionsMessage(proposal, view.fieldIdx);
  await editMessageText(chatId, messageId, text, { reply_markup });
}

/**
 * Re-renders an edited, already-approved auto-record proposal (ADR-033) via
 * the dedicated "✅ Registrado… [✏️ Editar] [↩︎ Deshacer]" notice view instead
 * of the generic card — matching what the original notification looked like
 * before the edit. Field-mapping mirrors deliver-to-telegram.ts's
 * sendAutoRecordNotification (the template for the FIRST notice): amount/
 * wallet come straight from params, category name is resolved from
 * editable[0].options by the selected appCategoryId, and ruleMatchType/
 * ruleMatchValue were denormalized onto params at auto-record creation time
 * (see auto-record-transaction.ts).
 */
async function editMessageWithAutoRecordNotice(
  chatId: number,
  messageId: number,
  proposal: ProposalDescriptor,
): Promise<void> {
  const params = proposal.params as {
    amount: number;
    appCategoryId: string;
    wallet: string;
    ruleMatchType?: string;
    ruleMatchValue?: string;
  };
  const categoryName =
    proposal.editable?.[0]?.options.find((o) => o.id === params.appCategoryId)?.label ?? "?";

  const { text, reply_markup } = toTelegramAutoRecordMessage({
    proposalId: proposal.id,
    amountText: formatCOP(params.amount),
    appCategoryName: categoryName,
    wallet: params.wallet,
    ruleMatchType: params.ruleMatchType ?? "?",
    ruleMatchValue: params.ruleMatchValue ?? "?",
  });

  await editMessageText(chatId, messageId, text, { reply_markup });
}

async function handleEditOpenCallback(
  cbq: TelegramCallbackQuery,
  proposalId: string,
  fieldIdx: number,
): Promise<void> {
  const chatId = cbq.message?.chat?.id;
  const messageId = cbq.message?.message_id;
  if (chatId == null || messageId == null) return;

  const proposal = await loadProposalDescriptor(proposalId);
  if (!proposal) {
    await answerCallbackQuery(cbq.id, PROPOSAL_NOT_FOUND_MSG);
    return;
  }

  await answerCallbackQuery(cbq.id, "");
  await editMessageWithProposal(chatId, messageId, proposal, { fieldIdx });
}

async function handleEditBackCallback(cbq: TelegramCallbackQuery, proposalId: string): Promise<void> {
  const chatId = cbq.message?.chat?.id;
  const messageId = cbq.message?.message_id;
  if (chatId == null || messageId == null) return;

  const proposal = await loadProposalDescriptor(proposalId);
  if (!proposal) {
    await answerCallbackQuery(cbq.id, PROPOSAL_NOT_FOUND_MSG);
    return;
  }

  await answerCallbackQuery(cbq.id, "");
  await editMessageWithProposal(chatId, messageId, proposal, "card");
}

type EditSelection = { field: EditableField; option: { id: string; label: string } };

async function resolveEditSelection(
  proposalId: string,
  fieldIdx: number,
  optIdx: number,
): Promise<EditSelection | null> {
  const proposal = await loadProposalDescriptor(proposalId);
  const field = proposal?.editable?.[fieldIdx];
  const option = field?.options[optIdx];
  if (!field || !option) return null;
  return { field, option };
}

/**
 * "Otra…" (__other__) is a synthetic option, not a real id to persist —
 * prompt for free text instead. The next normal text message is picked up by
 * the agent's ordinary prompt behavior (Part D), which re-resolves the typed
 * name and re-issues the proposal; no special state machine needed.
 */
async function promptForOtherCategory(cbq: TelegramCallbackQuery, chatId: number): Promise<void> {
  await answerCallbackQuery(cbq.id, "");
  await sendMessage(chatId, "Escribe la categoría");
}

async function handleEditApplyCallback(
  cbq: TelegramCallbackQuery,
  proposalId: string,
  fieldIdx: number,
  optIdx: number,
): Promise<void> {
  const chatId = cbq.message?.chat?.id;
  const messageId = cbq.message?.message_id;
  if (chatId == null || messageId == null) return;

  const selection = await resolveEditSelection(proposalId, fieldIdx, optIdx);
  if (!selection) {
    await answerCallbackQuery(cbq.id, "Invalid selection.");
    return;
  }

  if (selection.option.id === "__other__") {
    await promptForOtherCategory(cbq, chatId);
    return;
  }

  const result = await applyProposalEdit(proposalId, selection.field.field, selection.option.id);
  if (!result.ok || !result.descriptor) {
    await answerCallbackQuery(cbq.id, result.message ?? "Could not apply edit.");
    return;
  }

  await answerCallbackQuery(cbq.id, "Updated.");
  if (result.isAutoRecorded) {
    await editMessageWithAutoRecordNotice(chatId, messageId, result.descriptor);
  } else {
    await editMessageWithProposal(chatId, messageId, result.descriptor, "card");
  }
}

// `resolveProposal`'s `message` is normally the generic "Approved" default
// (see execute-proposal.ts), which the persistent edited-message text below
// replaces with a friendlier "✅ Approved" — unchanged behavior for every
// action. Some actions (currently only the batch's `propose_add_transactions_batch`,
// via its generic `message` escape hatch) opt into returning their own
// meaningful reply — e.g. "✅ Agregadas N · Total X · mueve X a tu pocket de
// Bancolombia." — which the user needs as a persistent, readable chat message,
// not just the ephemeral answerCallbackQuery toast. Surface that real message
// instead of clobbering it with the generic text.
function approvedMessageText(resultMessage: string): string {
  return resultMessage && resultMessage !== "Approved" ? resultMessage : "✅ Approved";
}

async function handleResolveCallback(
  cbq: TelegramCallbackQuery,
  proposalId: string,
  choiceId: "approve" | "dismiss",
): Promise<void> {
  const result = await resolveProposal({ proposalId, choiceId });

  await answerCallbackQuery(cbq.id, result.message);

  // Edit the message to reflect the resolved state and remove the buttons
  const chatId = cbq.message?.chat?.id;
  const messageId = cbq.message?.message_id;
  if (chatId == null || messageId == null) return;

  const resolvedText = choiceId === "approve" ? approvedMessageText(result.message) : "❌ Dismissed";
  await editMessageText(chatId, messageId, resolvedText, { reply_markup: undefined });

  if (choiceId === "approve" && result.ok) {
    await sendUndoButtonIfReversible(chatId, proposalId);
    if (result.learnRuleNudge) {
      await sendMessage(chatId, result.learnRuleNudge);
    }
  }
}

// Editable-field callback formats (ADR-031), all prefixed `${proposalId}:`:
//   eopen:{fieldIdx}          — reveal option buttons for one field
//   e:{fieldIdx}:{optIdx}     — apply the selected option, re-render the card
//   eback                     — restore the default card view
// Checked via a trailing-segment match (not lastIndexOf(":")) since these
// formats contain multiple colons themselves, unlike the plain approve/dismiss
// format the fallback parse below still handles.
const EDIT_OPEN_RE = /^(.+):eopen:(\d+)$/;
const EDIT_APPLY_RE = /^(.+):e:(\d+):(\d+)$/;
const EDIT_BACK_RE = /^(.+):eback$/;

async function tryHandleEditCallback(cbq: TelegramCallbackQuery, data: string): Promise<boolean> {
  const applyMatch = data.match(EDIT_APPLY_RE);
  if (applyMatch) {
    await handleEditApplyCallback(cbq, applyMatch[1], Number(applyMatch[2]), Number(applyMatch[3]));
    return true;
  }

  const openMatch = data.match(EDIT_OPEN_RE);
  if (openMatch) {
    await handleEditOpenCallback(cbq, openMatch[1], Number(openMatch[2]));
    return true;
  }

  const backMatch = data.match(EDIT_BACK_RE);
  if (backMatch) {
    await handleEditBackCallback(cbq, backMatch[1]);
    return true;
  }

  return false;
}

// ─── Batch callbacks (ADR-034 — card-screenshot ingestion) ───────────────────
// `bt:{idx}`/`bs:{idx}:{optIdx}`/`bc:{optIdx}` mutate the batch state stored on
// PendingProposal.params.batch and re-render the batch card view — they do
// NOT approve. `be:{idx}`/`bo` are read-only navigation (open the category or
// card-label picker); `bback` restores the default batch card. Mirrors
// tryHandleEditCallback's dispatch shape exactly.

async function editMessageWithBatchProposal(
  chatId: number,
  messageId: number,
  proposal: ProposalDescriptor,
  view: "card" | "cardLabel" | { itemIdx: number },
): Promise<void> {
  const { text, reply_markup } =
    view === "card"
      ? toTelegramBatchMessage(proposal)
      : view === "cardLabel"
        ? toTelegramBatchCardLabelMessage(proposal)
        : toTelegramBatchCategoryMessage(proposal, view.itemIdx);
  await editMessageText(chatId, messageId, text, { reply_markup });
}

async function handleBatchToggleCallback(cbq: TelegramCallbackQuery, proposalId: string, idx: number): Promise<void> {
  const chatId = cbq.message?.chat?.id;
  const messageId = cbq.message?.message_id;
  if (chatId == null || messageId == null) return;

  const result = await toggleBatchItem(proposalId, idx);
  if (!result.ok || !result.descriptor) {
    await answerCallbackQuery(cbq.id, result.message ?? "Could not toggle item.");
    return;
  }

  await answerCallbackQuery(cbq.id, "Updated.");
  await editMessageWithBatchProposal(chatId, messageId, result.descriptor, "card");
}

async function handleBatchCategoryOpenCallback(cbq: TelegramCallbackQuery, proposalId: string, idx: number): Promise<void> {
  const chatId = cbq.message?.chat?.id;
  const messageId = cbq.message?.message_id;
  if (chatId == null || messageId == null) return;

  const proposal = await loadProposalDescriptor(proposalId);
  if (!proposal?.batch) {
    await answerCallbackQuery(cbq.id, PROPOSAL_NOT_FOUND_MSG);
    return;
  }

  await answerCallbackQuery(cbq.id, "");
  await editMessageWithBatchProposal(chatId, messageId, proposal, { itemIdx: idx });
}

async function handleBatchCategorySetCallback(
  cbq: TelegramCallbackQuery,
  proposalId: string,
  idx: number,
  optIdx: number,
): Promise<void> {
  const chatId = cbq.message?.chat?.id;
  const messageId = cbq.message?.message_id;
  if (chatId == null || messageId == null) return;

  const result = await setBatchItemCategory(proposalId, idx, optIdx);
  if (!result.ok || !result.descriptor) {
    await answerCallbackQuery(cbq.id, result.message ?? "Could not set category.");
    return;
  }

  await answerCallbackQuery(cbq.id, "Updated.");
  await editMessageWithBatchProposal(chatId, messageId, result.descriptor, "card");
}

async function handleBatchCardLabelOpenCallback(cbq: TelegramCallbackQuery, proposalId: string): Promise<void> {
  const chatId = cbq.message?.chat?.id;
  const messageId = cbq.message?.message_id;
  if (chatId == null || messageId == null) return;

  const proposal = await loadProposalDescriptor(proposalId);
  if (!proposal?.batch) {
    await answerCallbackQuery(cbq.id, PROPOSAL_NOT_FOUND_MSG);
    return;
  }

  await answerCallbackQuery(cbq.id, "");
  await editMessageWithBatchProposal(chatId, messageId, proposal, "cardLabel");
}

async function handleBatchCardLabelSetCallback(cbq: TelegramCallbackQuery, proposalId: string, optIdx: number): Promise<void> {
  const chatId = cbq.message?.chat?.id;
  const messageId = cbq.message?.message_id;
  if (chatId == null || messageId == null) return;

  const result = await setBatchCardLabel(proposalId, optIdx);
  if (!result.ok || !result.descriptor) {
    await answerCallbackQuery(cbq.id, result.message ?? "Could not set card label.");
    return;
  }

  await answerCallbackQuery(cbq.id, "Updated.");
  await editMessageWithBatchProposal(chatId, messageId, result.descriptor, "card");
}

async function handleBatchBackCallback(cbq: TelegramCallbackQuery, proposalId: string): Promise<void> {
  const chatId = cbq.message?.chat?.id;
  const messageId = cbq.message?.message_id;
  if (chatId == null || messageId == null) return;

  const proposal = await loadProposalDescriptor(proposalId);
  if (!proposal?.batch) {
    await answerCallbackQuery(cbq.id, PROPOSAL_NOT_FOUND_MSG);
    return;
  }

  await answerCallbackQuery(cbq.id, "");
  await editMessageWithBatchProposal(chatId, messageId, proposal, "card");
}

const BATCH_TOGGLE_RE = /^(.+):bt:(\d+)$/;
const BATCH_CATEGORY_SET_RE = /^(.+):bs:(\d+):(\d+)$/;
const BATCH_CATEGORY_OPEN_RE = /^(.+):be:(\d+)$/;
const BATCH_CARD_LABEL_OPEN_RE = /^(.+):bo$/;
const BATCH_CARD_LABEL_SET_RE = /^(.+):bc:(\d+)$/;
const BATCH_BACK_RE = /^(.+):bback$/;

async function tryHandleBatchCallback(cbq: TelegramCallbackQuery, data: string): Promise<boolean> {
  const toggleMatch = data.match(BATCH_TOGGLE_RE);
  if (toggleMatch) {
    await handleBatchToggleCallback(cbq, toggleMatch[1], Number(toggleMatch[2]));
    return true;
  }

  const categorySetMatch = data.match(BATCH_CATEGORY_SET_RE);
  if (categorySetMatch) {
    await handleBatchCategorySetCallback(cbq, categorySetMatch[1], Number(categorySetMatch[2]), Number(categorySetMatch[3]));
    return true;
  }

  const categoryOpenMatch = data.match(BATCH_CATEGORY_OPEN_RE);
  if (categoryOpenMatch) {
    await handleBatchCategoryOpenCallback(cbq, categoryOpenMatch[1], Number(categoryOpenMatch[2]));
    return true;
  }

  const cardLabelOpenMatch = data.match(BATCH_CARD_LABEL_OPEN_RE);
  if (cardLabelOpenMatch) {
    await handleBatchCardLabelOpenCallback(cbq, cardLabelOpenMatch[1]);
    return true;
  }

  const cardLabelSetMatch = data.match(BATCH_CARD_LABEL_SET_RE);
  if (cardLabelSetMatch) {
    await handleBatchCardLabelSetCallback(cbq, cardLabelSetMatch[1], Number(cardLabelSetMatch[2]));
    return true;
  }

  const backMatch = data.match(BATCH_BACK_RE);
  if (backMatch) {
    await handleBatchBackCallback(cbq, backMatch[1]);
    return true;
  }

  return false;
}

async function handleCallbackQuery(cbq: TelegramCallbackQuery): Promise<void> {
  const data = cbq.data ?? "";

  // Handle undo callback: "undo:{proposalId}"
  if (data.startsWith("undo:")) {
    await handleUndoCallback(cbq, data.slice(5));
    return;
  }

  if (await tryHandleEditCallback(cbq, data)) {
    return;
  }

  if (await tryHandleBatchCallback(cbq, data)) {
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

  await handleResolveCallback(cbq, proposalId, choiceId);
}
