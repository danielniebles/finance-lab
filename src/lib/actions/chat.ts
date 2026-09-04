"use server";

import { db } from "@/lib/db";

// Event rows (role "event") are the system's own record of what happened —
// they exist for the model's context and the audit trail, not for the chat
// UI, which renders these rows as bubbles. Excluded here so the web chat
// keeps showing only the conversation. See agent/events.ts.
export async function getMessages() {
  return db.chatMessage.findMany({
    where: { role: { not: "event" } },
    orderBy: { createdAt: "asc" },
  });
}

export async function saveMessage(
  role: "user" | "assistant" | "event",
  content: string,
  channel?: "web" | "telegram" | "shortcut",
) {
  return db.chatMessage.create({ data: { role, content, channel: channel ?? null } });
}

export async function clearHistory() {
  await db.chatMessage.deleteMany({});
}
