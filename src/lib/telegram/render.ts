import type { ProposalDescriptor } from "@/lib/agent/types";

// Convert a ProposalDescriptor to a Telegram message with inline keyboard buttons.
// callback_data format: `${proposalId}:${choiceId}` (cuid = 25 chars, "approve" = 7 → ~33 chars; well within Telegram's 64-byte limit)

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function toTelegramMessage(p: ProposalDescriptor): {
  text: string;
  reply_markup: { inline_keyboard: { text: string; callback_data: string }[][] };
} {
  const fieldsText = p.fields
    .map((f) => `${escapeHtml(f.label)}: ${escapeHtml(f.value)}`)
    .join("\n");

  const parts = [`<b>${escapeHtml(p.title)}</b>`];
  if (fieldsText) parts.push(fieldsText);
  if (p.reasoning) parts.push(`<i>${escapeHtml(p.reasoning)}</i>`);

  const text = parts.join("\n\n");

  const inline_keyboard = [
    p.choices.map((choice) => ({
      text: choice.id === "approve" ? "✅ Approve" : "❌ Dismiss",
      callback_data: `${p.id}:${choice.id}`,
    })),
  ];

  return { text, reply_markup: { inline_keyboard } };
}
