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
