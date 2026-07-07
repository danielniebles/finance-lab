// @vitest-environment node
//
// Regression coverage for runTurnAndDeliverToTelegram()'s "typing…" indicator.
// Reviewer finding: the indicator was sent unconditionally, including from the
// /api/ingest (channel: "shortcut") entry point, where there's no live human
// typing in the Telegram conversation. Fixed to only fire for genuine live
// Telegram conversations (channel "telegram" or the default/unset case).

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    chatMessage: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/lib/actions/chat", () => ({
  saveMessage: vi.fn().mockResolvedValue(undefined),
}));

const runAgentTurnMock = vi.fn().mockResolvedValue({ text: undefined, proposals: [] });
vi.mock("@/lib/agent/run-agent-turn", () => ({
  runAgentTurn: (...args: unknown[]) => runAgentTurnMock(...args),
}));

const sendMessageMock = vi.fn().mockResolvedValue(undefined);
const sendChatActionMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/telegram/api", () => ({
  sendMessage: (...args: unknown[]) => sendMessageMock(...args),
  sendChatAction: (...args: unknown[]) => sendChatActionMock(...args),
}));

vi.mock("@/lib/telegram/render", () => ({
  toTelegramMessage: vi.fn(),
}));

import { db } from "@/lib/db";
import { runTurnAndDeliverToTelegram } from "./deliver-to-telegram";

describe("runTurnAndDeliverToTelegram — typing indicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAgentTurnMock.mockResolvedValue({ text: undefined, proposals: [] });
    process.env.TELEGRAM_ALLOWED_CHAT_ID = "12345";
  });

  it("sends the typing indicator for a live Telegram conversation", async () => {
    await runTurnAndDeliverToTelegram("hola", { channel: "telegram" });

    expect(sendChatActionMock).toHaveBeenCalledWith("12345", "typing");
  });

  it("does not send the typing indicator for the shortcut ingest entry point", async () => {
    await runTurnAndDeliverToTelegram("Compra aprobada por $45.000", { channel: "shortcut" });

    expect(sendChatActionMock).not.toHaveBeenCalled();
  });

  it("defaults to shortcut (no typing indicator) when opts is omitted", async () => {
    await runTurnAndDeliverToTelegram("hola");

    expect(sendChatActionMock).not.toHaveBeenCalled();
  });
});

// ─── History window (ADR-029) ────────────────────────────────────────────────
// Regression for the confirmed root cause: history was previously fetched
// `orderBy: "asc", take: 20`, which grabs the 20 OLDEST rows, not the most
// recent. Once a conversation exceeds 20 messages, the agent became
// permanently blind to anything recent. Fixed to `desc + take: 20` then
// `.reverse()` back to chronological order.

describe("runTurnAndDeliverToTelegram — history window", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAgentTurnMock.mockResolvedValue({ text: undefined, proposals: [] });
    process.env.TELEGRAM_ALLOWED_CHAT_ID = "12345";
  });

  it("fetches the most recent 20 messages (desc + take), not the oldest", async () => {
    await runTurnAndDeliverToTelegram("hola", { channel: "telegram" });

    expect(db.chatMessage.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  });

  it("restores chronological order before passing history to runAgentTurn", async () => {
    const oldest = { role: "user", content: "first", createdAt: new Date("2026-01-01") };
    const newest = { role: "assistant", content: "latest", createdAt: new Date("2026-01-03") };
    // DB returns newest-first (desc); the helper must reverse it back to
    // chronological order before the incoming message is appended.
    vi.mocked(db.chatMessage.findMany).mockResolvedValueOnce([newest, oldest] as never);

    await runTurnAndDeliverToTelegram("nuevo mensaje", { channel: "telegram" });

    expect(runAgentTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: "user", content: "first" },
          { role: "assistant", content: "latest" },
          { role: "user", content: "nuevo mensaje" },
        ],
      }),
    );
  });
});

// ─── Ingest echo ──────────────────────────────────────────────────────────────

describe("runTurnAndDeliverToTelegram — ingest echo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAgentTurnMock.mockResolvedValue({ text: undefined, proposals: [] });
    process.env.TELEGRAM_ALLOWED_CHAT_ID = "12345";
  });

  it("echoes the raw text to Telegram before running the turn, for the shortcut channel", async () => {
    await runTurnAndDeliverToTelegram("Compra aprobada $11.956 en Uber", { channel: "shortcut" });

    expect(sendMessageMock).toHaveBeenCalledWith(
      "12345",
      "📥 Procesando: Compra aprobada $11.956 en Uber",
    );
  });

  it("does not echo for a normal Telegram conversation (already visible in-chat)", async () => {
    await runTurnAndDeliverToTelegram("hola", { channel: "telegram" });

    const echoCalls = sendMessageMock.mock.calls.filter(([, text]) =>
      String(text).startsWith("📥 Procesando:"),
    );
    expect(echoCalls).toHaveLength(0);
  });
});
