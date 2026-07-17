import type { ProposalDescriptor, EditableField, BatchDescriptor } from "@/lib/agent/types";
import { formatCOP } from "@/lib/format";

// Convert a ProposalDescriptor to a Telegram message with inline keyboard buttons.
//
// callback_data byte budget (Telegram's hard limit is 64 bytes):
//   `${proposalId}:${choiceId}`          — cuid (25) + ":" + "approve" (7) ≈ 33 bytes
//   `${proposalId}:e:{fieldIdx}:{optIdx}` — cuid (25) + ":e:" (3) + two small digits (≤4) ≈ 32 bytes
//   `${proposalId}:eopen:{fieldIdx}`      — cuid (25) + ":eopen:" (7) + one small digit ≈ 33 bytes
// All comfortably under 64 bytes — INDICES are used instead of ids specifically
// to keep this true regardless of id length (ADR-031).

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type InlineButton = { text: string; callback_data: string };
type TelegramRenderedMessage = { text: string; reply_markup: { inline_keyboard: InlineButton[][] } };

function buildEditableButtonsRow(id: string, editable: EditableField[]): InlineButton[] {
  return editable.map((e, fieldIdx) => ({
    text: `✏️ ${e.label}`,
    callback_data: `${id}:eopen:${fieldIdx}`,
  }));
}

/** Default card view: title + fields + [editable buttons row] + [Approve/Dismiss row]. */
export function toTelegramMessage(p: ProposalDescriptor): TelegramRenderedMessage {
  const fieldsText = p.fields
    .map((f) => `${escapeHtml(f.label)}: ${escapeHtml(f.value)}`)
    .join("\n");

  const editableText = (p.editable ?? [])
    .map((e) => {
      const selected = e.options.find((o) => o.id === e.selectedId);
      return `${escapeHtml(e.label)}: ${escapeHtml(selected?.label ?? e.selectedId)}`;
    })
    .join("\n");

  const parts = [`<b>${escapeHtml(p.title)}</b>`];
  if (fieldsText) parts.push(fieldsText);
  if (editableText) parts.push(editableText);
  if (p.reasoning) parts.push(`<i>${escapeHtml(p.reasoning)}</i>`);

  const text = parts.join("\n\n");

  const inline_keyboard: InlineButton[][] = [];
  if (p.editable && p.editable.length > 0) {
    inline_keyboard.push(buildEditableButtonsRow(p.id, p.editable));
  }
  inline_keyboard.push(
    p.choices.map((choice) => ({
      text: choice.id === "approve" ? "✅ Approve" : "❌ Dismiss",
      callback_data: `${p.id}:${choice.id}`,
    })),
  );

  return { text, reply_markup: { inline_keyboard } };
}

export type AutoRecordNotice = {
  proposalId: string;
  amountText: string;
  appCategoryName: string;
  wallet: string;
  ruleMatchType: string;
  ruleMatchValue: string;
};

/**
 * Auto-record notification (ADR-033): sent when a CounterpartyRule match
 * already created the transaction (no card was ever shown). Reuses the
 * EXISTING callback formats verbatim — `eopen:0` (as if field index 0 were
 * the category, mirroring the normal propose_add_transaction descriptor
 * shape) reveals the category options, and `undo:{proposalId}` is the same
 * format the ordinary post-approval Undo button already uses
 * (sendUndoButtonIfReversible in telegram/route.ts) — no new callback_data
 * format needed for either button.
 */
export function toTelegramAutoRecordMessage(notice: AutoRecordNotice): TelegramRenderedMessage {
  const lines = [
    `✅ <b>Recorded</b>: ${escapeHtml(notice.amountText)} → ${escapeHtml(notice.appCategoryName)}`,
    `Wallet: ${escapeHtml(notice.wallet)}`,
    `<i>Rule: ${escapeHtml(notice.ruleMatchType)} "${escapeHtml(notice.ruleMatchValue)}"</i>`,
  ];

  const inline_keyboard: InlineButton[][] = [
    [
      { text: "✏️ Edit", callback_data: `${notice.proposalId}:eopen:0` },
      { text: "↩︎ Undo", callback_data: `undo:${notice.proposalId}` },
    ],
  ];

  return { text: lines.join("\n"), reply_markup: { inline_keyboard } };
}

/**
 * Option-picker view for one editable field: shows every option as its own
 * button (selected one marked with a ✓ prefix), plus a back button that
 * restores the default card view. Read-only navigation — no DB mutation
 * happens when this view is shown (only `eopen:` triggered it).
 */
export function toTelegramEditOptionsMessage(
  p: ProposalDescriptor,
  fieldIdx: number,
): TelegramRenderedMessage {
  const field = p.editable?.[fieldIdx];
  const text = `<b>${escapeHtml(p.title)}</b>\n\n${escapeHtml(field?.label ?? "")}:`;

  const optionButtons: InlineButton[] = (field?.options ?? []).map((opt, optIdx) => ({
    text: opt.id === field?.selectedId ? `✓ ${opt.label}` : opt.label,
    callback_data: `${p.id}:e:${fieldIdx}:${optIdx}`,
  }));

  // One option per row keeps labels readable; back button on its own row.
  const inline_keyboard: InlineButton[][] = optionButtons.map((b) => [b]);
  inline_keyboard.push([{ text: "⬅︎ Back", callback_data: `${p.id}:eback` }]);

  return { text, reply_markup: { inline_keyboard } };
}

// ─── Batch proposal rendering (ADR-034 — card-screenshot ingestion) ─────────
//
// callback_data formats, all prefixed `${proposalId}:` (indices only, per the
// 64-byte budget documented above):
//   bt:{idx}          — toggle item[idx].included
//   be:{idx}          — open the category picker for item[idx]
//   bs:{idx}:{optIdx} — set item[idx].appCategoryId from categoryOptions[optIdx]
//   bo                — open the card-label picker (read-only navigation)
//   bc:{optIdx}       — set batch.cardLabel from cardLabelOptions[optIdx]
//   bback             — restore the default batch card view (from either picker)
// approve/dismiss reuse the EXISTING `${proposalId}:approve|dismiss` format —
// no new code needed there, the generic fallback in route.ts already handles it.
//
// Long statements (~30+ items): Telegram allows ~100 buttons per message, and
// two buttons/item stays comfortably under that up to ~30 items. Beyond that,
// this renders every item unpaginated — a known, documented limitation (see
// .scratch/card-screenshot-batch-proposal.md) rather than a pagination system,
// per the handoff's explicit "note as an edge case, not a hard requirement."

const MAX_BATCH_ITEM_BUTTON_ROWS = 30;

function batchItemLine(item: BatchDescriptor["items"][number], idx: number, categoryLabel: string): string {
  const marker = item.included ? "✓" : "✕ (crossed out)";
  const scratchNote = item.scratchDetected ? " ⚠︎" : "";
  return `${idx + 1}. ${marker} ${escapeHtml(item.vendor)} ${escapeHtml(formatCOP(-Math.abs(item.amount)))} → ${escapeHtml(categoryLabel)}${scratchNote}`;
}

/** Full batch review card: numbered list + per-item toggle/edit buttons + card-label + approve/dismiss. */
export function toTelegramBatchMessage(p: ProposalDescriptor): TelegramRenderedMessage {
  const batch = p.batch;
  if (!batch) {
    // Defensive: should never happen (caller only invokes this when p.batch is set).
    return toTelegramMessage(p);
  }

  const categoryById = new Map(batch.categoryOptions.map((c) => [c.id, c.label]));
  const includedCount = batch.items.filter((i) => i.included).length;
  const total = batch.items
    .filter((i) => i.included)
    .reduce((sum, i) => sum + Math.abs(i.amount), 0);

  const lines = batch.items.map((item, idx) =>
    batchItemLine(item, idx, categoryById.get(item.appCategoryId) ?? "?"),
  );

  const text = [
    `<b>${escapeHtml(p.title)}</b>`,
    `Card: ${escapeHtml(batch.cardLabel)}`,
    lines.join("\n"),
    `Included: ${includedCount} · Total: ${escapeHtml(formatCOP(total))}`,
  ].join("\n\n");

  const inline_keyboard: InlineButton[][] = [];
  batch.items.slice(0, MAX_BATCH_ITEM_BUTTON_ROWS).forEach((item, idx) => {
    inline_keyboard.push([
      { text: `${idx + 1} ${item.included ? "✓" : "✕"}`, callback_data: `${p.id}:bt:${idx}` },
      { text: `${idx + 1} ✏️`, callback_data: `${p.id}:be:${idx}` },
    ]);
  });

  inline_keyboard.push([{ text: "💳 Card", callback_data: `${p.id}:bo` }]);
  inline_keyboard.push(
    p.choices.map((choice) => ({
      text: choice.id === "approve" ? `✅ Approve ${includedCount}` : "❌ Discard",
      callback_data: `${p.id}:${choice.id}`,
    })),
  );

  return { text, reply_markup: { inline_keyboard } };
}

/**
 * Category picker for one batch item — same shape as toTelegramEditOptionsMessage
 * (one option per row, ✓ marks the current selection, back button restores the
 * batch card), adapted for batch.categoryOptions + the `bs:{idx}:{optIdx}` format.
 */
export function toTelegramBatchCategoryMessage(
  p: ProposalDescriptor,
  itemIdx: number,
): TelegramRenderedMessage {
  const batch = p.batch;
  const item = batch?.items[itemIdx];
  const text = `<b>${escapeHtml(p.title)}</b>\n\nCategory for ${escapeHtml(item?.vendor ?? "?")}:`;

  const optionButtons: InlineButton[] = (batch?.categoryOptions ?? []).map((opt, optIdx) => ({
    text: opt.id === item?.appCategoryId ? `✓ ${opt.label}` : opt.label,
    callback_data: `${p.id}:bs:${itemIdx}:${optIdx}`,
  }));

  const inline_keyboard: InlineButton[][] = optionButtons.map((b) => [b]);
  inline_keyboard.push([{ text: "⬅︎ Back", callback_data: `${p.id}:bback` }]);

  return { text, reply_markup: { inline_keyboard } };
}

/**
 * Card-label picker — same shape, over batch.cardLabelOptions, using the
 * `bc:{optIdx}` format (no item index needed, it's a batch-level field).
 */
export function toTelegramBatchCardLabelMessage(p: ProposalDescriptor): TelegramRenderedMessage {
  const batch = p.batch;
  const text = `<b>${escapeHtml(p.title)}</b>\n\nCard:`;

  const optionButtons: InlineButton[] = (batch?.cardLabelOptions ?? []).map((opt, optIdx) => ({
    text: opt.id === batch?.cardLabel || opt.label === batch?.cardLabel ? `✓ ${opt.label}` : opt.label,
    callback_data: `${p.id}:bc:${optIdx}`,
  }));

  const inline_keyboard: InlineButton[][] = optionButtons.map((b) => [b]);
  inline_keyboard.push([{ text: "⬅︎ Back", callback_data: `${p.id}:bback` }]);

  return { text, reply_markup: { inline_keyboard } };
}
