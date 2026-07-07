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

// ─── File download (image ingestion) ──────────────────────────────────────────
// Telegram sends only a file_id for a photo; the actual bytes live behind a
// second lookup (getFile → file_path) and then a separate file-host URL (not
// the Bot API host). Two round-trips, same as every Telegram client does.

type TelegramFileResult = { ok: boolean; result?: { file_path?: string } };

/** Resolves a Telegram `file_id` to its downloadable `file_path`, or null on failure. */
export async function getFile(fileId: string): Promise<string | null> {
  const json = (await tgPost("getFile", { file_id: fileId })) as TelegramFileResult | null;
  return json?.ok ? (json.result?.file_path ?? null) : null;
}

function mediaTypeFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  // Telegram photos are always re-encoded to JPEG server-side regardless of
  // the source format, so this is the correct default for the photo case.
  return "image/jpeg";
}

/**
 * Downloads a Telegram file by its resolved `file_path` and returns it as a
 * base64 string ready for an Anthropic image content block, plus the inferred
 * media type. Returns null on any failure (network error, non-2xx response).
 */
export async function downloadFile(
  filePath: string,
): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const res = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`);
    if (!res.ok) {
      console.error(`[telegram/downloadFile] non-ok response: ${res.status}`);
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return { base64: buffer.toString("base64"), mediaType: mediaTypeFromPath(filePath) };
  } catch (err) {
    console.error("[telegram/downloadFile] fetch error:", err);
    return null;
  }
}
