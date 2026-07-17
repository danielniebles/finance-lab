// @vitest-environment node
//
// Unit tests for applyProposalEdit — the shared "apply an edit" mutation used
// by both the Telegram callback handler and POST /api/proposals/edit (ADR-031).

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    pendingProposal: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock("@/lib/actions/transactions", () => ({
  updateTransactionCategory: vi.fn(),
}));

import { db } from "@/lib/db";
import { updateTransactionCategory } from "@/lib/actions/transactions";
import { applyProposalEdit } from "./apply-proposal-edit";

const CATEGORY_EDITABLE = [
  {
    field: "appCategoryId",
    label: "Category",
    selectedId: "cat-1",
    options: [
      { id: "cat-1", label: "Groceries" },
      { id: "cat-2", label: "Going Out" },
      { id: "__other__", label: "Other…" },
    ],
  },
];

function makePendingProposal(overrides?: Record<string, unknown>) {
  return {
    id: "prop-1",
    action: "propose_add_transaction",
    params: { amount: -11_956, date: "2026-07-06", appCategoryId: "cat-1", wallet: "Bancolombia" },
    title: "Add expense: Bancolombia — $11.956",
    status: "pending",
    channel: "telegram",
    editable: CATEGORY_EDITABLE,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("applyProposalEdit", () => {
  it("updates params[field] and editable[fieldIndex].selectedId on success", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(makePendingProposal() as never);

    const result = await applyProposalEdit("prop-1", "appCategoryId", "cat-2");

    expect(result.ok).toBe(true);
    expect(result.descriptor?.params.appCategoryId).toBe("cat-2");
    expect(result.descriptor?.editable?.[0].selectedId).toBe("cat-2");

    expect(db.pendingProposal.update).toHaveBeenCalledWith({
      where: { id: "prop-1" },
      data: {
        params: expect.objectContaining({ appCategoryId: "cat-2" }),
        editable: [expect.objectContaining({ field: "appCategoryId", selectedId: "cat-2" })],
      },
    });
  });

  it("does not mutate other params fields", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(makePendingProposal() as never);

    const result = await applyProposalEdit("prop-1", "appCategoryId", "cat-2");

    expect(result.descriptor?.params).toMatchObject({
      amount: -11_956,
      date: "2026-07-06",
      wallet: "Bancolombia",
    });
  });

  it("fails gracefully when the proposal is not found", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(null);

    const result = await applyProposalEdit("missing", "appCategoryId", "cat-2");

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not found/i);
    expect(db.pendingProposal.update).not.toHaveBeenCalled();
  });

  it("fails gracefully on a non-pending proposal (already approved)", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makePendingProposal({ status: "approved" }) as never,
    );

    const result = await applyProposalEdit("prop-1", "appCategoryId", "cat-2");

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already approved/);
    expect(db.pendingProposal.update).not.toHaveBeenCalled();
  });

  it("fails gracefully on an unknown field", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(makePendingProposal() as never);

    const result = await applyProposalEdit("prop-1", "notAField", "cat-2");

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Unknown editable field/);
  });

  it("fails gracefully on an unknown option id", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(makePendingProposal() as never);

    const result = await applyProposalEdit("prop-1", "appCategoryId", "cat-999");

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Unknown option/);
  });

  it("refuses to apply the synthetic __other__ sentinel directly", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(makePendingProposal() as never);

    const result = await applyProposalEdit("prop-1", "appCategoryId", "__other__");

    expect(result.ok).toBe(false);
    expect(db.pendingProposal.findUnique).not.toHaveBeenCalled();
  });

  it("rebuilds fields from the updated params via buildProposalFields, excluding appCategoryId", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(makePendingProposal() as never);

    const result = await applyProposalEdit("prop-1", "appCategoryId", "cat-2");

    expect(result.descriptor?.fields.some((f) => f.label === "AppCategoryId")).toBe(false);
    expect(result.descriptor?.fields.some((f) => f.label === "Wallet")).toBe(true);
  });
});

// ─── Editing an already-auto-recorded transaction (ADR-033) ─────────────────

describe("applyProposalEdit — approved auto-record case", () => {
  it("accepts an edit on an approved, reversible proposal that carries a createdId", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makePendingProposal({
        status: "approved",
        params: { ...makePendingProposal().params, createdId: "txn-1" },
      }) as never,
    );

    const result = await applyProposalEdit("prop-1", "appCategoryId", "cat-2");

    expect(result.ok).toBe(true);
    expect(db.pendingProposal.update).toHaveBeenCalled();
  });

  it("also patches the LIVE transaction's category via updateTransactionCategory", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makePendingProposal({
        status: "approved",
        params: { ...makePendingProposal().params, createdId: "txn-1" },
      }) as never,
    );

    await applyProposalEdit("prop-1", "appCategoryId", "cat-2");

    expect(updateTransactionCategory).toHaveBeenCalledWith("txn-1", "cat-2");
  });

  it("still rejects an approved proposal with NO createdId (not the auto-record case)", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makePendingProposal({ status: "approved" }) as never, // no createdId in params
    );

    const result = await applyProposalEdit("prop-1", "appCategoryId", "cat-2");

    expect(result.ok).toBe(false);
    expect(db.pendingProposal.update).not.toHaveBeenCalled();
    expect(updateTransactionCategory).not.toHaveBeenCalled();
  });

  it("still rejects a dismissed/undone proposal even if it happens to carry a createdId", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makePendingProposal({
        status: "undone",
        params: { ...makePendingProposal().params, createdId: "txn-1" },
      }) as never,
    );

    const result = await applyProposalEdit("prop-1", "appCategoryId", "cat-2");

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already undone/);
  });

  it("does not patch the live entity for an action other than propose_add_transaction", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makePendingProposal({
        action: "propose_create_installment",
        status: "approved",
        params: { ...makePendingProposal().params, createdId: "inst-1" },
      }) as never,
    );

    const result = await applyProposalEdit("prop-1", "appCategoryId", "cat-2");

    // propose_create_installment IS reversible (has undo) and carries a
    // createdId, so the edit itself succeeds — but there's no live-entity
    // sync wired for this action, so updateTransactionCategory must not fire.
    expect(result.ok).toBe(true);
    expect(updateTransactionCategory).not.toHaveBeenCalled();
  });
});
