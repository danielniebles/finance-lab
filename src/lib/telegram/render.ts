import type { ProposalDescriptor, EditableField } from "@/lib/agent/types";

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
  inline_keyboard.push([{ text: "⬅︎ Volver", callback_data: `${p.id}:eback` }]);

  return { text, reply_markup: { inline_keyboard } };
}
