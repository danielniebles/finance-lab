// Telegram Bot API helpers.
// Required server-only env vars: TELEGRAM_BOT_TOKEN

const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

async function tgPost(method: string, body: Record<string, unknown>): Promise<unknown> {
  try {
    const res = await fetch(`${BASE}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.ok) {
      console.error(`[telegram/${method}] error:`, json);
    }
    return json;
  } catch (err) {
    console.error(`[telegram/${method}] fetch error:`, err);
    return null;
  }
}

export function sendMessage(
  chatId: string | number,
  text: string,
  options?: { reply_markup?: unknown; parse_mode?: string },
): Promise<unknown> {
  return tgPost("sendMessage", { chat_id: chatId, text, ...options });
}

export function answerCallbackQuery(
  callbackQueryId: string,
  text: string,
): Promise<unknown> {
  return tgPost("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

export function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  options?: { reply_markup?: unknown },
): Promise<unknown> {
  return tgPost("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    ...options,
  });
}

export function sendChatAction(
  chatId: string | number,
  action: "typing",
): Promise<unknown> {
  return tgPost("sendChatAction", { chat_id: chatId, action });
}
