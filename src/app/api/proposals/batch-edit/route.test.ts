// @vitest-environment node
//
// Tests for POST /api/proposals/batch-edit (ADR-034) — the web counterpart to
// Telegram's bt:/bs:/bc: callbacks, dispatching to the same shared
// apply-batch-edit.ts mutations by a discriminated `op` field.

import { describe, it, expect, vi, beforeEach } from "vitest";

const toggleBatchItemMock = vi.fn();
const setBatchItemCategoryMock = vi.fn();
const setBatchCardLabelMock = vi.fn();
vi.mock("@/lib/agent/apply-batch-edit", () => ({
  toggleBatchItem: (...args: unknown[]) => toggleBatchItemMock(...args),
  setBatchItemCategory: (...args: unknown[]) => setBatchItemCategoryMock(...args),
  setBatchCardLabel: (...args: unknown[]) => setBatchCardLabelMock(...args),
}));

import { POST } from "./route";

function makeRequest(body: unknown): Parameters<typeof POST>[0] {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/proposals/batch-edit", () => {
  it("400s when proposalId or op is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("dispatches op=toggle to toggleBatchItem", async () => {
    toggleBatchItemMock.mockResolvedValue({ ok: true, descriptor: { id: "prop-1" } });

    const res = await POST(makeRequest({ proposalId: "prop-1", op: "toggle", itemIdx: 2 }));

    expect(toggleBatchItemMock).toHaveBeenCalledWith("prop-1", 2);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("400s on op=toggle with missing itemIdx", async () => {
    const res = await POST(makeRequest({ proposalId: "prop-1", op: "toggle" }));
    expect(res.status).toBe(400);
    expect(toggleBatchItemMock).not.toHaveBeenCalled();
  });

  it("dispatches op=setCategory to setBatchItemCategory", async () => {
    setBatchItemCategoryMock.mockResolvedValue({ ok: true, descriptor: { id: "prop-1" } });

    await POST(makeRequest({ proposalId: "prop-1", op: "setCategory", itemIdx: 0, optionIdx: 1 }));

    expect(setBatchItemCategoryMock).toHaveBeenCalledWith("prop-1", 0, 1);
  });

  it("400s on op=setCategory with missing optionIdx", async () => {
    const res = await POST(makeRequest({ proposalId: "prop-1", op: "setCategory", itemIdx: 0 }));
    expect(res.status).toBe(400);
    expect(setBatchItemCategoryMock).not.toHaveBeenCalled();
  });

  it("dispatches op=setCardLabel to setBatchCardLabel", async () => {
    setBatchCardLabelMock.mockResolvedValue({ ok: true, descriptor: { id: "prop-1" } });

    await POST(makeRequest({ proposalId: "prop-1", op: "setCardLabel", optionIdx: 1 }));

    expect(setBatchCardLabelMock).toHaveBeenCalledWith("prop-1", 1);
  });

  it("400s on an unknown op", async () => {
    const res = await POST(makeRequest({ proposalId: "prop-1", op: "bogus" }));
    expect(res.status).toBe(400);
  });
});
