"use server";

import { db } from "@/lib/db";

export async function getMessages() {
  return db.chatMessage.findMany({
    orderBy: { createdAt: "asc" },
  });
}

export async function saveMessage(
  role: "user" | "assistant",
  content: string,
  channel?: "web" | "telegram",
) {
  return db.chatMessage.create({ data: { role, content, channel: channel ?? null } });
}

export async function clearHistory() {
  await db.chatMessage.deleteMany({});
}
