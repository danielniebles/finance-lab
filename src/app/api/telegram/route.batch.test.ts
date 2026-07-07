// @vitest-environment node
//
// Unit tests for POST /api/telegram's batch callback dispatch (ADR-034 —
// card-screenshot batch ingestion): bt:/be:/bs:/bo/bc:/bback. Mirrors the
// mocking conventions in route.test.ts — `after()` is mocked to invoke its
// callback synchronously.

import { describe, it, expect, vi, beforeEach } from "vitest";

let pendingAfterCallback: Promise<void> = Promise.resolve();
const afterMock = vi.fn((cb: () => Promise<void>) => {
  pendingAfterCallback = cb();
});
vi.mock("next/server", () => ({
  after: (cb: () => Promise<void>) => afterMock(cb),
  NextRequest: class {},
}));

const findUniqueMock = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    pendingProposal: { findUnique: (...args: unknown[]) => findUniqueMock(...args) },
  },
}));

vi.mock("@/lib/agent/run-agent-turn", () => ({ runAgentTurn: vi.fn() }));
vi.mock("@/lib/agent/deliver-to-telegram", () => ({
  runTurnAndDeliverToTelegram: vi.fn(),
  runImageTurnAndDeliverToTelegram: vi.fn(),
  saveAssistantTurn: vi.fn(),
}));
const resolveProposalMock = vi.fn();
vi.mock("@/lib/agent/execute-proposal", () => ({
  resolveProposal: (...args: unknown[]) => resolveProposalMock(...args),
}));
vi.mock("@/lib/agent/apply-proposal-edit", () => ({ applyProposalEdit: vi.fn() }));

const toggleBatchItemMock = vi.fn();
const setBatchItemCategoryMock = vi.fn();
const setBatchCardLabelMock = vi.fn();
vi.mock("@/lib/agent/apply-batch-edit", () => ({
  toggleBatchItem: (...args: unknown[]) => toggleBatchItemMock(...args),
  setBatchItemCategory: (...args: unknown[]) => setBatchItemCategoryMock(...args),
  setBatchCardLabel: (...args: unknown[]) => setBatchCardLabelMock(...args),
}));

const sendMessageMock = vi.fn().mockResolvedValue(undefined);
const answerCallbackQueryMock = vi.fn().mockResolvedValue(undefined);
const editMessageTextMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/telegram/api", () => ({
  sendMessage: (...args: unknown[]) => sendMessageMock(...args),
  answerCallbackQuery: (...args: unknown[]) => answerCallbackQueryMock(...args),
  editMessageText: (...args: unknown[]) => editMessageTextMock(...args),
  getFile: vi.fn(),
  downloadFile: vi.fn(),
}));

const toTelegramBatchMessageMock = vi.fn().mockReturnValue({
  text: "batch card",
  reply_markup: { inline_keyboard: [] },
});
const toTelegramBatchCategoryMessageMock = vi.fn().mockReturnValue({
  text: "batch category picker",
  reply_markup: { inline_keyboard: [] },
});
const toTelegramBatchCardLabelMessageMock = vi.fn().mockReturnValue({
  text: "batch card-label picker",
  reply_markup: { inline_keyboard: [] },
});
vi.mock("@/lib/telegram/render", () => ({
  toTelegramMessage: vi.fn().mockReturnValue({ text: "generic", reply_markup: { inline_keyboard: [] } }),
  toTelegramEditOptionsMessage: vi.fn(),
  toTelegramAutoRecordMessage: vi.fn(),
  toTelegramBatchMessage: (...args: unknown[]) => toTelegramBatchMessageMock(...args),
  toTelegramBatchCategoryMessage: (...args: unknown[]) => toTelegramBatchCategoryMessageMock(...args),
  toTelegramBatchCardLabelMessage: (...args: unknown[]) => toTelegramBatchCardLabelMessageMock(...args),
}));

vi.mock("@/lib/agent/actions", () => ({ REVERSIBLE_ACTIONS: ["propose_add_transactions_batch"] }));

import { POST } from "./route";

const BATCH = {
  cardLabel: "Visa Platino",
  categoryOptions: [
    { id: "cat-going-out", label: "Going Out" },
    { id: "cat-groceries", label: "Groceries" },
  ],
  cardLabelOptions: [
    { id: "Visa Platino", label: "Visa Platino" },
    { id: "Mastercard Oro", label: "Mastercard Oro" },
  ],
  items: [
    { vendor: "Rappi", amount: 45000, appCategoryId: "cat-going-out", included: true },
    { vendor: "Uber", amount: 12000, appCategoryId: "cat-going-out", included: false, scratchDetected: true },
  ],
};

function makeCallbackUpdate(data: string, updateId = 1) {
  return {
    update_id: updateId,
    callback_query: {
      id: "cbq-1",
      from: { id: 999 },
      message: { message_id: 42, chat: { id: 12345 }, text: "..." },
      data,
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

function makeBatchDescriptor(overrides?: Record<string, unknown>) {
  return {
    id: "prop-1",
    action: "propose_add_transactions_batch",
    params: { batch: BATCH },
    title: "Add transactions batch: Visa Platino — 1 items, $45.000 COP",
    fields: [],
    reasoning: "",
    choices: [
      { id: "approve", label: "Approve", style: "primary" },
      { id: "dismiss", label: "Dismiss" },
    ],
    batch: BATCH,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TELEGRAM_WEBHOOK_SECRET = "correct-webhook-secret";
  process.env.TELEGRAM_ALLOWED_CHAT_ID = "12345";
});

describe("POST /api/telegram — batch toggle (bt:)", () => {
  it("toggles the item and re-renders the batch card view", async () => {
    toggleBatchItemMock.mockResolvedValue({ ok: true, descriptor: makeBatchDescriptor() });

    const res = await POST(makeRequest(makeCallbackUpdate("prop-1:bt:1")));
    await pendingAfterCallback;

    expect(res.status).toBe(200);
    expect(toggleBatchItemMock).toHaveBeenCalledWith("prop-1", 1);
    expect(toTelegramBatchMessageMock).toHaveBeenCalled();
    expect(editMessageTextMock).toHaveBeenCalledWith(12345, 42, "batch card", expect.anything());
  });

  it("answers with an error and does not edit the message on failure", async () => {
    toggleBatchItemMock.mockResolvedValue({ ok: false, message: "Item index out of range: 5" });

    const res = await POST(makeRequest(makeCallbackUpdate("prop-1:bt:5", 2)));
    await pendingAfterCallback;

    expect(res.status).toBe(200);
    expect(answerCallbackQueryMock).toHaveBeenCalledWith("cbq-1", "Item index out of range: 5");
    expect(editMessageTextMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/telegram — batch category open (be:) and set (bs:)", () => {
  it("opens the category picker for the given item index", async () => {
    findUniqueMock.mockResolvedValue({
      id: "prop-1",
      action: "propose_add_transactions_batch",
      params: { batch: BATCH },
      title: "title",
      editable: null,
    });

    const res = await POST(makeRequest(makeCallbackUpdate("prop-1:be:0", 3)));
    await pendingAfterCallback;

    expect(res.status).toBe(200);
    expect(toTelegramBatchCategoryMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "prop-1" }),
      0,
    );
    expect(editMessageTextMock).toHaveBeenCalledWith(12345, 42, "batch category picker", expect.anything());
  });

  it("sets the item's category and re-renders the batch card view", async () => {
    setBatchItemCategoryMock.mockResolvedValue({ ok: true, descriptor: makeBatchDescriptor() });

    const res = await POST(makeRequest(makeCallbackUpdate("prop-1:bs:0:1", 4)));
    await pendingAfterCallback;

    expect(res.status).toBe(200);
    expect(setBatchItemCategoryMock).toHaveBeenCalledWith("prop-1", 0, 1);
    expect(toTelegramBatchMessageMock).toHaveBeenCalled();
  });
});

describe("POST /api/telegram — card label open (bo) and set (bc:)", () => {
  it("opens the card-label picker", async () => {
    findUniqueMock.mockResolvedValue({
      id: "prop-1",
      action: "propose_add_transactions_batch",
      params: { batch: BATCH },
      title: "title",
      editable: null,
    });

    const res = await POST(makeRequest(makeCallbackUpdate("prop-1:bo", 5)));
    await pendingAfterCallback;

    expect(res.status).toBe(200);
    expect(toTelegramBatchCardLabelMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "prop-1" }),
    );
    expect(editMessageTextMock).toHaveBeenCalledWith(12345, 42, "batch card-label picker", expect.anything());
  });

  it("sets the card label and re-renders the batch card view", async () => {
    setBatchCardLabelMock.mockResolvedValue({ ok: true, descriptor: makeBatchDescriptor() });

    const res = await POST(makeRequest(makeCallbackUpdate("prop-1:bc:1", 6)));
    await pendingAfterCallback;

    expect(res.status).toBe(200);
    expect(setBatchCardLabelMock).toHaveBeenCalledWith("prop-1", 1);
    expect(toTelegramBatchMessageMock).toHaveBeenCalled();
  });
});

describe("POST /api/telegram — batch back (bback)", () => {
  it("restores the default batch card view", async () => {
    findUniqueMock.mockResolvedValue({
      id: "prop-1",
      action: "propose_add_transactions_batch",
      params: { batch: BATCH },
      title: "title",
      editable: null,
    });

    const res = await POST(makeRequest(makeCallbackUpdate("prop-1:bback", 7)));
    await pendingAfterCallback;

    expect(res.status).toBe(200);
    expect(toTelegramBatchMessageMock).toHaveBeenCalled();
  });
});

describe("POST /api/telegram — batch callback formats do not collide with the approve/dismiss fallback", () => {
  it("does not call resolveProposal for a bt: callback", async () => {
    toggleBatchItemMock.mockResolvedValue({ ok: true, descriptor: makeBatchDescriptor() });

    await POST(makeRequest(makeCallbackUpdate("prop-1:bt:0", 8)));
    await pendingAfterCallback;

    expect(resolveProposalMock).not.toHaveBeenCalled();
  });
});

// ─── Approve-callback message surfacing (reconcile pass) ────────────────────
// resolveProposal's `result.message` is normally the generic "Approved"
// default, which the toast-only answerCallbackQuery already carries — fine to
// keep showing "✅ Approved" as the persistent edited-message text. But the
// batch action's execute() opts into the generic `message` escape hatch to
// return a real, meaningful summary ("✅ Agregadas N · Total X · mueve X a tu
// pocket de Bancolombia.") that the user needs to actually read and refer back
// to — that summary must become the persistent edited-message text, not just
// flash as an ephemeral toast.
describe("POST /api/telegram — approve callback surfaces the resolved message as persistent text", () => {
  it("uses the batch's rich summary as the edited message text on approve", async () => {
    const summary = "✅ Agregadas 2 · Total $57.000 · mueve $57.000 a tu pocket de Bancolombia.";
    resolveProposalMock.mockResolvedValue({ ok: true, message: summary });
    findUniqueMock.mockResolvedValue({ action: "propose_add_transactions_batch" });

    const res = await POST(makeRequest(makeCallbackUpdate("prop-1:approve", 9)));
    await pendingAfterCallback;

    expect(res.status).toBe(200);
    expect(resolveProposalMock).toHaveBeenCalledWith({ proposalId: "prop-1", choiceId: "approve" });
    expect(editMessageTextMock).toHaveBeenCalledWith(
      12345,
      42,
      summary,
      expect.objectContaining({ reply_markup: undefined }),
    );
  });

  it("still shows the plain '✅ Approved' text for a non-batch reversible action", async () => {
    resolveProposalMock.mockResolvedValue({ ok: true, message: "Approved" });
    findUniqueMock.mockResolvedValue({ action: "propose_add_transactions_batch" });

    const res = await POST(makeRequest(makeCallbackUpdate("prop-2:approve", 10)));
    await pendingAfterCallback;

    expect(res.status).toBe(200);
    expect(editMessageTextMock).toHaveBeenCalledWith(
      12345,
      42,
      "✅ Approved",
      expect.objectContaining({ reply_markup: undefined }),
    );
  });

  it("shows the plain '❌ Dismissed' text for a dismiss callback, ignoring result.message", async () => {
    resolveProposalMock.mockResolvedValue({ ok: true, message: "Dismissed" });

    const res = await POST(makeRequest(makeCallbackUpdate("prop-3:dismiss", 11)));
    await pendingAfterCallback;

    expect(res.status).toBe(200);
    expect(editMessageTextMock).toHaveBeenCalledWith(
      12345,
      42,
      "❌ Dismissed",
      expect.objectContaining({ reply_markup: undefined }),
    );
  });
});
