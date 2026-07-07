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
vi.mock("@/lib/agent/actions", () => ({
  PROPOSAL_ACTIONS: {
    propose_add_transaction: { execute: vi.fn().mockResolvedValue(undefined) },
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
