// @vitest-environment node
//
// Tests for resolveProposal's learn-from-correction nudge (ADR-033, Part 3):
// approving a propose_add_transaction that had an extractable counterparty
// but matched NO rule at all offers to remember it. Every other case
// (no counterparty extracted, or a rule DID match) must not carry the nudge.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    pendingProposal: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  },
}));
const executeMock = vi.fn().mockResolvedValue(undefined);
const batchExecuteMock = vi.fn();
vi.mock("@/lib/agent/actions", () => ({
  PROPOSAL_ACTIONS: {
    propose_add_transaction: { execute: (...args: unknown[]) => executeMock(...args) },
    propose_add_transactions_batch: { execute: (...args: unknown[]) => batchExecuteMock(...args) },
  },
}));

import { db } from "@/lib/db";
import { resolveProposal } from "./execute-proposal";

function makeProposal(overrides?: Record<string, unknown>) {
  return {
    id: "prop-1",
    action: "propose_add_transaction",
    status: "pending",
    params: { amount: -5_000, appCategoryId: "cat-1", wallet: "Bancolombia" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveProposal — learn-from-correction nudge", () => {
  it("offers to remember when there was no rule match and a counterparty was extracted", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makeProposal({
        params: {
          amount: -5_000,
          appCategoryId: "cat-1",
          wallet: "Bancolombia",
          hadCounterpartyMatch: false,
          counterpartyAccount: "61793614704",
        },
      }) as never,
    );

    const result = await resolveProposal({ proposalId: "prop-1", choiceId: "approve" });

    expect(result.ok).toBe(true);
    expect(result.learnRuleNudge).toBeDefined();
    expect(result.learnRuleNudge).toContain("61793614704");
  });

  it("does not offer a nudge when a rule DID match (hadCounterpartyMatch: true)", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makeProposal({
        params: {
          amount: -5_000,
          appCategoryId: "cat-1",
          wallet: "Bancolombia",
          hadCounterpartyMatch: true,
          counterpartyAccount: "61793614704",
        },
      }) as never,
    );

    const result = await resolveProposal({ proposalId: "prop-1", choiceId: "approve" });

    expect(result.learnRuleNudge).toBeUndefined();
  });

  it("does not offer a nudge when no counterparty was extracted at all", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makeProposal({
        params: { amount: -5_000, appCategoryId: "cat-1", wallet: "Bancolombia" },
      }) as never,
    );

    const result = await resolveProposal({ proposalId: "prop-1", choiceId: "approve" });

    expect(result.learnRuleNudge).toBeUndefined();
  });

  it("does not offer a nudge for actions other than propose_add_transaction", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makeProposal({
        action: "propose_create_vault",
        params: { hadCounterpartyMatch: false, counterpartyAccount: "61793614704" },
      }) as never,
    );

    const result = await resolveProposal({ proposalId: "prop-1", choiceId: "approve" });

    expect(result.learnRuleNudge).toBeUndefined();
  });

  it("does not offer a nudge on dismiss", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makeProposal({
        params: { hadCounterpartyMatch: false, counterpartyAccount: "61793614704" },
      }) as never,
    );

    const result = await resolveProposal({ proposalId: "prop-1", choiceId: "dismiss" });

    expect(result.learnRuleNudge).toBeUndefined();
  });
});

// ─── Generic execute()-returned message escape hatch (ADR-034) ─────────────
// An action's execute() may return a `message` string to use in place of the
// hardcoded "Approved" default (e.g. the batch's "Agregadas N · Total X"
// summary) — a generic mechanism, not a batch-specific special case. Every
// existing action (propose_add_transaction) that does NOT return a message
// must keep getting the plain "Approved" default, unaffected.

describe("resolveProposal — execute()-returned message escape hatch", () => {
  it("uses the default 'Approved' message when execute() returns no message field", async () => {
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makeProposal({ action: "propose_add_transaction" }) as never,
    );

    const result = await resolveProposal({ proposalId: "prop-1", choiceId: "approve" });

    expect(result.message).toBe("Approved");
  });

  it("uses execute()'s returned message when present, instead of 'Approved'", async () => {
    batchExecuteMock.mockResolvedValue({
      createdIds: ["txn-1", "txn-2"],
      count: 2,
      total: 75000,
      message: "✅ Agregadas 2 · Total $75.000 · mueve $75.000 a tu pocket de Bancolombia.",
    });
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makeProposal({
        action: "propose_add_transactions_batch",
        params: { batch: { cardLabel: "Visa", items: [], categoryOptions: [], cardLabelOptions: [] } },
      }) as never,
    );

    const result = await resolveProposal({ proposalId: "prop-1", choiceId: "approve" });

    expect(result.ok).toBe(true);
    expect(result.message).toContain("Agregadas 2");
    expect(result.message).toContain("pocket de Bancolombia");
  });

  it("does not persist the message field onto PendingProposal.params", async () => {
    batchExecuteMock.mockResolvedValue({
      createdIds: ["txn-1"],
      count: 1,
      total: 45000,
      message: "✅ Agregadas 1 · Total $45.000 · mueve $45.000 a tu pocket de Bancolombia.",
    });
    vi.mocked(db.pendingProposal.findUnique).mockResolvedValue(
      makeProposal({
        action: "propose_add_transactions_batch",
        params: { batch: { cardLabel: "Visa", items: [], categoryOptions: [], cardLabelOptions: [] } },
      }) as never,
    );

    await resolveProposal({ proposalId: "prop-1", choiceId: "approve" });

    const persistedParamsCall = vi.mocked(db.pendingProposal.update).mock.calls.find(
      (call) => (call[0] as { data: { params?: Record<string, unknown> } }).data.params,
    );
    expect(persistedParamsCall).toBeDefined();
    const persistedParams = (persistedParamsCall?.[0] as { data: { params: Record<string, unknown> } }).data.params;
    expect(persistedParams.message).toBeUndefined();
    expect(persistedParams.createdIds).toEqual(["txn-1"]);
  });
});
