// @vitest-environment node
//
// Unit tests for the shared batch-mutation functions (ADR-034): toggle an
// item's included flag, set an item's category, set the batch-level card
// label. Same shared-mutation pattern as apply-proposal-edit.test.ts —
// these are used identically by both the Telegram bt:/bs:/bc: callbacks and
// POST /api/proposals/batch-edit.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    pendingProposal: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

import { db } from "@/lib/db";
import { toggleBatchItem, setBatchItemCategory, setBatchCardLabel } from "./apply-batch-edit";
import type { BatchDescriptor } from "./types";

const BATCH: BatchDescriptor = {
  cardLabel: "Visa Platino",
  categoryOptions: [
    { id: "cat-going-out", label: "Going Out" },
    { id: "cat-groceries", label: "Groceries" },
  ],
  cardLabelOptions: [
    { id: "Visa Platino", label: "Visa Platino" },
    { id: "Mastercard Oro", label: "Mastercard Oro" },
    { id: "__other__", label: "Otra…" },
  ],
  items: [
    { vendor: "Rappi", amount: 45000, appCategoryId: "cat-going-out", included: true },
    { vendor: "Uber", amount: 12000, appCategoryId: "cat-going-out", included: false, scratchDetected: true },
  ],
};

function makePendingProposal(overrides?: Record<string, unknown>) {
  return {
    id: "prop-1",
    action: "propose_add_transactions_batch",
    params: { batch: BATCH },
    title: "Add transactions batch: Visa Platino — 1 items, $45.000 COP",
    status: "pending",
    channel: "telegram",
    editable: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("toggleBatchItem", () => {
  it("flips item.included and persists the updated batch", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(makePendingProposal() as never);

    const result = await toggleBatchItem("prop-1", 1);

    expect(result.ok).toBe(true);
    expect(result.descriptor?.batch?.items[1].included).toBe(true);
    expect(db.pendingProposal.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "prop-1" } }),
    );
  });

  it("does not affect other items", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(makePendingProposal() as never);

    const result = await toggleBatchItem("prop-1", 1);

    expect(result.descriptor?.batch?.items[0].included).toBe(true);
  });

  it("fails gracefully on an out-of-range index", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(makePendingProposal() as never);

    const result = await toggleBatchItem("prop-1", 99);

    expect(result.ok).toBe(false);
    expect(db.pendingProposal.update).not.toHaveBeenCalled();
  });

  it("fails gracefully when the proposal is not found", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(null);

    const result = await toggleBatchItem("missing", 0);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });

  it("fails gracefully on a non-pending proposal", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makePendingProposal({ status: "approved" }) as never,
    );

    const result = await toggleBatchItem("prop-1", 0);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already approved/);
  });

  it("fails gracefully on a non-batch proposal", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makePendingProposal({ params: { amount: -1000 } }) as never,
    );

    const result = await toggleBatchItem("prop-1", 0);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not a batch/i);
  });
});

describe("setBatchItemCategory", () => {
  it("sets item.appCategoryId from categoryOptions[optIdx]", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(makePendingProposal() as never);

    const result = await setBatchItemCategory("prop-1", 0, 1);

    expect(result.ok).toBe(true);
    expect(result.descriptor?.batch?.items[0].appCategoryId).toBe("cat-groceries");
  });

  it("does not affect other items' categories", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(makePendingProposal() as never);

    const result = await setBatchItemCategory("prop-1", 0, 1);

    expect(result.descriptor?.batch?.items[1].appCategoryId).toBe("cat-going-out");
  });

  it("fails gracefully on an out-of-range item index", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(makePendingProposal() as never);

    const result = await setBatchItemCategory("prop-1", 99, 0);

    expect(result.ok).toBe(false);
  });

  it("fails gracefully on an out-of-range option index", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(makePendingProposal() as never);

    const result = await setBatchItemCategory("prop-1", 0, 99);

    expect(result.ok).toBe(false);
  });
});

describe("setBatchCardLabel", () => {
  it("sets batch.cardLabel from cardLabelOptions[optIdx] — applies to every included row's wallet at approve time", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(makePendingProposal() as never);

    const result = await setBatchCardLabel("prop-1", 1);

    expect(result.ok).toBe(true);
    expect(result.descriptor?.batch?.cardLabel).toBe("Mastercard Oro");
  });

  it("fails gracefully on an out-of-range option index", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(makePendingProposal() as never);

    const result = await setBatchCardLabel("prop-1", 99);

    expect(result.ok).toBe(false);
  });
});
