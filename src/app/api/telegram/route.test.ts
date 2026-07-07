// @vitest-environment node
//
// Unit tests for POST /api/telegram's callback_query handling — specifically
// the "edit an already-auto-recorded proposal" regression (reconcile pass,
// ADR-033 follow-up). Reviewer finding: handleEditApplyCallback always
// re-rendered via the generic card view (toTelegramMessage / "card"), even
// when the edited proposal was an auto-recorded one (status "approved"),
// which should re-render via the dedicated auto-record notice view
// (toTelegramAutoRecordMessage) instead — matching what the original
// notification looked like before the edit.
//
// `next/server`'s real `after()` throws outside a request scope; mocked here
// to invoke its callback synchronously, same pattern as ingest/route.test.ts.

import { describe, it, expect, vi, beforeEach } from "vitest";

let pendingAfterCallback: Promise<void> = Promise.resolve();
const afterMock = vi.fn((cb: () => Promise<void>) => {
  pendingAfterCallback = cb();
});
vi.mock("next/server", () => ({
  after: (cb: () => Promise<void>) => afterMock(cb),
  NextRequest: class {},
}));

vi.mock("@/lib/db", () => ({
  db: {
    pendingProposal: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/agent/run-agent-turn", () => ({
  runAgentTurn: vi.fn(),
}));

vi.mock("@/lib/agent/deliver-to-telegram", () => ({
  runTurnAndDeliverToTelegram: vi.fn(),
  saveAssistantTurn: vi.fn(),
}));

vi.mock("@/lib/agent/execute-proposal", () => ({
  resolveProposal: vi.fn(),
}));

const applyProposalEditMock = vi.fn();
vi.mock("@/lib/agent/apply-proposal-edit", () => ({
  applyProposalEdit: (...args: unknown[]) => applyProposalEditMock(...args),
}));

const sendMessageMock = vi.fn().mockResolvedValue(undefined);
const answerCallbackQueryMock = vi.fn().mockResolvedValue(undefined);
const editMessageTextMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/telegram/api", () => ({
  sendMessage: (...args: unknown[]) => sendMessageMock(...args),
  answerCallbackQuery: (...args: unknown[]) => answerCallbackQueryMock(...args),
  editMessageText: (...args: unknown[]) => editMessageTextMock(...args),
}));

const toTelegramMessageMock = vi.fn().mockReturnValue({
  text: "generic card",
  reply_markup: { inline_keyboard: [] },
});
const toTelegramAutoRecordMessageMock = vi.fn().mockReturnValue({
  text: "auto-record notice",
  reply_markup: { inline_keyboard: [] },
});
vi.mock("@/lib/telegram/render", () => ({
  toTelegramMessage: (...args: unknown[]) => toTelegramMessageMock(...args),
  toTelegramEditOptionsMessage: vi.fn(),
  toTelegramAutoRecordMessage: (...args: unknown[]) => toTelegramAutoRecordMessageMock(...args),
}));

vi.mock("@/lib/agent/actions", () => ({
  REVERSIBLE_ACTIONS: ["propose_add_transaction"],
}));

import { POST } from "./route";

const CATEGORY_EDITABLE = [
  {
    field: "appCategoryId",
    label: "Categoría",
    selectedId: "cat-pets",
    options: [
      { id: "cat-pets", label: "Pets" },
      { id: "cat-family", label: "Family" },
      { id: "__other__", label: "Otra…" },
    ],
  },
];

function makeApplyCallbackUpdate(fieldIdx: number, optIdx: number) {
  return {
    update_id: 1,
    callback_query: {
      id: "cbq-1",
      from: { id: 999 },
      message: { message_id: 42, chat: { id: 12345 }, text: "..." },
      data: `prop-1:e:${fieldIdx}:${optIdx}`,
    },
  };
}

function makeRequest(update: unknown): Parameters<typeof POST>[0] {
  return {
    headers: {
      get: (name: string) =>
        name === "x-telegram-bot-api-secret-token" ? "correct-webhook-secret" : null,
    },
    json: async () => update,
  } as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/telegram — handleEditApplyCallback re-render view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_WEBHOOK_SECRET = "correct-webhook-secret";
    process.env.TELEGRAM_ALLOWED_CHAT_ID = "12345";
  });

  it("re-renders via the auto-record notice view when the edited proposal is auto-recorded", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue({
      id: "prop-1",
      action: "propose_add_transaction",
      params: { amount: -45_000, appCategoryId: "cat-pets", wallet: "Investments" },
      title: "Add expense: Investments — $45.000",
      editable: CATEGORY_EDITABLE,
    } as never);

    applyProposalEditMock.mockResolvedValue({
      ok: true,
      isAutoRecorded: true,
      descriptor: {
        id: "prop-1",
        action: "propose_add_transaction",
        params: {
          amount: -45_000,
          appCategoryId: "cat-family",
          wallet: "Investments",
          ruleMatchType: "ACCOUNT",
          ruleMatchValue: "61793614704",
        },
        title: "Add expense: Investments — $45.000",
        fields: [],
        reasoning: "",
        choices: [],
        editable: CATEGORY_EDITABLE,
      },
    });

    const res = await POST(makeRequest(makeApplyCallbackUpdate(0, 1)));
    await pendingAfterCallback;
    expect(res.status).toBe(200);

    expect(toTelegramAutoRecordMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: "prop-1",
        appCategoryName: "Family",
        wallet: "Investments",
        ruleMatchType: "ACCOUNT",
        ruleMatchValue: "61793614704",
      }),
    );
    expect(toTelegramMessageMock).not.toHaveBeenCalled();
    expect(editMessageTextMock).toHaveBeenCalledWith(
      12345,
      42,
      "auto-record notice",
      expect.objectContaining({ reply_markup: expect.anything() }),
    );
  });

  it("still re-renders via the generic card view for an ordinary pending-proposal edit", async () => {
    const { db } = await import("@/lib/db");
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue({
      id: "prop-2",
      action: "propose_add_transaction",
      params: { amount: -20_000, appCategoryId: "cat-pets", wallet: "Bancolombia" },
      title: "Add expense: Bancolombia — $20.000",
      editable: CATEGORY_EDITABLE,
    } as never);

    applyProposalEditMock.mockResolvedValue({
      ok: true,
      isAutoRecorded: false,
      descriptor: {
        id: "prop-2",
        action: "propose_add_transaction",
        params: { amount: -20_000, appCategoryId: "cat-family", wallet: "Bancolombia" },
        title: "Add expense: Bancolombia — $20.000",
        fields: [],
        reasoning: "",
        choices: [],
        editable: CATEGORY_EDITABLE,
      },
    });

    const res = await POST(makeRequest({ ...makeApplyCallbackUpdate(0, 1), update_id: 2 }));
    await pendingAfterCallback;
    expect(res.status).toBe(200);

    expect(toTelegramMessageMock).toHaveBeenCalled();
    expect(toTelegramAutoRecordMessageMock).not.toHaveBeenCalled();
    expect(editMessageTextMock).toHaveBeenCalledWith(
      12345,
      42,
      "generic card",
      expect.objectContaining({ reply_markup: expect.anything() }),
    );
  });
});
