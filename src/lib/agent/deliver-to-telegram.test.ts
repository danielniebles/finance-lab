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
  toTelegramMessage: vi.fn().mockReturnValue({ text: "card", reply_markup: {} }),
}));

import { db } from "@/lib/db";
import { saveMessage } from "@/lib/actions/chat";
import { EVENT_ROLE } from "./events";
import {
  runTurnAndDeliverToTelegram,
  runImageTurnAndDeliverToTelegram,
  saveAssistantTurn,
} from "./deliver-to-telegram";

const INGEST_TEXT = "Compra aprobada";

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
      "📥 Processing: Compra aprobada $11.956 en Uber",
    );
  });

  it("does not echo for a normal Telegram conversation (already visible in-chat)", async () => {
    await runTurnAndDeliverToTelegram("hola", { channel: "telegram" });

    const echoCalls = sendMessageMock.mock.calls.filter(([, text]) =>
      String(text).startsWith("📥 Processing:"),
    );
    expect(echoCalls).toHaveLength(0);
  });
});

// ─── runImageTurnAndDeliverToTelegram (card-screenshot Part 1) ───────────────
// Verifies the image entry point round-trips: sends the "📸 Reading…" echo,
// persists a text placeholder (never raw image bytes) to ChatMessage, attaches
// the image content block only to the LIVE incoming message (history rows stay
// plain strings), and delivers the result exactly like the text path.

describe("runImageTurnAndDeliverToTelegram", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAgentTurnMock.mockResolvedValue({ text: "Veo 3 transacciones.", proposals: [] });
    process.env.TELEGRAM_ALLOWED_CHAT_ID = "12345";
  });

  const IMAGE = { base64: "ZmFrZS1pbWFnZS1ieXRlcw==", mediaType: "image/jpeg" };

  it("sends the 'Reading the screenshot' echo before running the turn", async () => {
    await runImageTurnAndDeliverToTelegram(IMAGE);

    expect(sendMessageMock).toHaveBeenCalledWith("12345", "📸 Reading the screenshot…");
  });

  it("persists a text placeholder to ChatMessage instead of raw image bytes", async () => {
    await runImageTurnAndDeliverToTelegram(IMAGE);

    expect(saveMessage).toHaveBeenCalledWith(
      "user",
      "📸 [card photo received]",
      "telegram",
    );
    // Never persist base64 image bytes anywhere in the call.
    const persistedCalls = vi.mocked(saveMessage).mock.calls;
    for (const call of persistedCalls) {
      expect(String(call[1])).not.toContain(IMAGE.base64);
    }
  });

  it("attaches the image content block only to the live incoming message", async () => {
    vi.mocked(db.chatMessage.findMany).mockResolvedValueOnce([
      { role: "user", content: "hola", createdAt: new Date("2026-01-01") },
    ] as never);

    await runImageTurnAndDeliverToTelegram(IMAGE);

    expect(runAgentTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: "user", content: "hola" },
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/jpeg", data: IMAGE.base64 },
              },
              { type: "text", text: expect.any(String) },
            ],
          },
        ],
      }),
    );
  });

  it("delivers the agent's text reply to Telegram like the text path", async () => {
    await runImageTurnAndDeliverToTelegram(IMAGE);

    expect(sendMessageMock).toHaveBeenCalledWith("12345", "Veo 3 transacciones.");
  });
});

// ─── Assistant turn persistence (agent event log) ────────────────────────────
// A proposal used to be recorded by appending "[Proposed: … — awaiting your
// approval]" into the ASSISTANT text. The model read that back as its own
// words and learned to imitate it — emitting the prose with no tool call
// behind it (production 2026-09-02). The record is now an event row: same
// ADR-027 guarantee that a text-less proposal turn still threads into history,
// correct authorship.

describe("saveAssistantTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const PROPOSAL = {
    id: "p1",
    action: "propose_add_transaction",
    title: "Add expense: Debit — $11.199",
  };

  it("never writes proposal prose into the assistant record", async () => {
    await saveAssistantTurn("Drafted for your approval.", [PROPOSAL], "telegram");

    const assistantWrites = vi
      .mocked(saveMessage)
      .mock.calls.filter((call) => call[0] === "assistant");
    expect(assistantWrites).toEqual([["assistant", "Drafted for your approval.", "telegram"]]);
    for (const call of vi.mocked(saveMessage).mock.calls) {
      expect(String(call[1])).not.toContain("[Proposed:");
    }
  });

  it("records each proposal as an event row", async () => {
    await saveAssistantTurn(undefined, [PROPOSAL], "telegram");

    expect(saveMessage).toHaveBeenCalledWith(
      EVENT_ROLE,
      expect.stringContaining("proposal_created id=p1 action=propose_add_transaction"),
      "telegram",
    );
  });

  it("still persists a turn whose only output is a proposal (ADR-027)", async () => {
    await saveAssistantTurn(undefined, [PROPOSAL], "telegram");

    expect(saveMessage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveMessage).mock.calls[0][0]).toBe(EVENT_ROLE);
  });

  it("records auto-recorded transactions as events too", async () => {
    await saveAssistantTurn("Recorded.", [], "telegram", [
      { proposalId: "p9", transactionId: "t9" },
    ]);

    expect(saveMessage).toHaveBeenCalledWith(
      EVENT_ROLE,
      expect.stringContaining("auto_recorded proposal=p9 txn=t9"),
      "telegram",
    );
  });

  it("writes nothing when there is no text, no proposal and no auto-record", async () => {
    await saveAssistantTurn(undefined, [], "telegram");

    expect(saveMessage).not.toHaveBeenCalled();
  });
});

// ─── Event replay ────────────────────────────────────────────────────────────

describe("runTurnAndDeliverToTelegram — event replay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runAgentTurnMock.mockResolvedValue({ text: undefined, proposals: [] });
    process.env.TELEGRAM_ALLOWED_CHAT_ID = "12345";
  });

  it("passes event rows through to the agent turn with their event role", async () => {
    vi.mocked(db.chatMessage.findMany).mockResolvedValueOnce([
      { role: EVENT_ROLE, content: "⟦event⟧ proposal_approved id=p1", createdAt: new Date() },
    ] as never);

    await runTurnAndDeliverToTelegram(INGEST_TEXT, { channel: "shortcut" });

    expect(runAgentTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: EVENT_ROLE, content: "⟦event⟧ proposal_approved id=p1" },
          { role: "user", content: INGEST_TEXT },
        ],
      }),
    );
  });

  // Replaying the model's own phantom prose back as context is precisely the
  // defect the event log fixes — the audit row must never re-enter the window.
  it("never replays an unbacked_claim row into the agent's context", async () => {
    vi.mocked(db.chatMessage.findMany).mockResolvedValueOnce([
      {
        role: EVENT_ROLE,
        content: '⟦event⟧ unbacked_claim text="Drafted for your approval — $11.199"',
        createdAt: new Date(),
      },
      { role: EVENT_ROLE, content: "⟦event⟧ proposal_approved id=p1", createdAt: new Date() },
    ] as never);

    await runTurnAndDeliverToTelegram(INGEST_TEXT, { channel: "shortcut" });

    const { messages } = runAgentTurnMock.mock.calls[0][0];
    expect(JSON.stringify(messages)).not.toContain("unbacked_claim");
    expect(messages).toHaveLength(2);
  });

  it("forces the first tool call for the shortcut channel only", async () => {
    await runTurnAndDeliverToTelegram(INGEST_TEXT, { channel: "shortcut" });
    expect(runAgentTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({ forceInitialToolUse: true }),
    );

    runAgentTurnMock.mockClear();
    await runTurnAndDeliverToTelegram("hola", { channel: "telegram" });
    expect(runAgentTurnMock).toHaveBeenCalledWith(
      expect.objectContaining({ forceInitialToolUse: false }),
    );
  });
});

// ─── Unbacked-claim ping (ADR-051) ───────────────────────────────────────────
// Scoped to the recovered case: an unrecovered claim already sends the user
// "Something went wrong drafting that", so pinging there would double up. The
// recovered case is the blind spot — the card looks normal and the only trace
// is a row nobody queries unprompted.

describe("unbacked-claim ping", () => {
  const WARNING = /reported an action it hadn't actually taken/;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_ALLOWED_CHAT_ID = "12345";
  });

  const pings = () =>
    sendMessageMock.mock.calls.filter(([, text]) => WARNING.test(String(text)));

  it("pings when the retry recovered the turn", async () => {
    runAgentTurnMock.mockResolvedValue({
      text: "Drafted for your approval.",
      proposals: [],
      unbackedClaim: { recovered: true },
    });

    await runTurnAndDeliverToTelegram(INGEST_TEXT, { channel: "shortcut" });

    expect(pings()).toHaveLength(1);
  });

  it("stays quiet when the claim was not recovered (user already sees the failure)", async () => {
    runAgentTurnMock.mockResolvedValue({
      text: "Something went wrong drafting that — nothing was recorded. Please try again.",
      proposals: [],
      unbackedClaim: { recovered: false },
    });

    await runTurnAndDeliverToTelegram(INGEST_TEXT, { channel: "shortcut" });

    expect(pings()).toHaveLength(0);
  });

  it("stays quiet on a normal turn", async () => {
    runAgentTurnMock.mockResolvedValue({ text: "Drafted.", proposals: [] });

    await runTurnAndDeliverToTelegram(INGEST_TEXT, { channel: "shortcut" });

    expect(pings()).toHaveLength(0);
  });
});
