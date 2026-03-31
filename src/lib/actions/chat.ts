"use server";

import { db } from "@/lib/db";

export async function getMessages() {
  return db.chatMessage.findMany({
    orderBy: { createdAt: "asc" },
  });
}

export async function saveMessage(role: "user" | "assistant", content: string) {
  return db.chatMessage.create({ data: { role, content } });
}

export async function clearHistory() {
  await db.chatMessage.deleteMany({});
}
