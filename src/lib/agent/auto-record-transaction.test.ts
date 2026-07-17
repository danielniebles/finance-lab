// @vitest-environment node
//
// Tests for the counterparty-rule auto-record side effect (ADR-033):
// isConfidentTransaction's sanity check, and autoRecordFromRule's write
// sequence (createTransaction → bump rule → persist an already-"approved"
// PendingProposal with the createdId shape undoAddTransaction expects).

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    pendingProposal: { create: vi.fn() },
  },
}));
vi.mock("@/lib/actions/transactions", () => ({
  createTransaction: vi.fn(),
}));
vi.mock("@/lib/queries/counterparty-rules", () => ({
  bumpCounterpartyRuleMatch: vi.fn(),
}));
vi.mock("@/lib/queries/expenses", () => ({
  getCategories: vi.fn(),
}));

import { db } from "@/lib/db";
import { createTransaction } from "@/lib/actions/transactions";
import { bumpCounterpartyRuleMatch, type CounterpartyRuleRow } from "@/lib/queries/counterparty-rules";
import { getCategories } from "@/lib/queries/expenses";
import { autoRecordFromRule, isConfidentTransaction } from "./auto-record-transaction";

const createTransactionMock = createTransaction as unknown as ReturnType<typeof vi.fn>;
const bumpMock = bumpCounterpartyRuleMatch as unknown as ReturnType<typeof vi.fn>;
const getCategoriesMock = getCategories as unknown as ReturnType<typeof vi.fn>;
const pendingProposalCreateMock = db.pendingProposal.create as unknown as ReturnType<typeof vi.fn>;

const RULE: CounterpartyRuleRow = {
  id: "rule-1",
  matchType: "ACCOUNT",
  matchValue: "61793614704",
  direction: "ANY",
  appCategoryId: "cat-pets",
  appCategoryName: "Pets",
  wallet: "Investments",
  walletId: null,
  autoRecord: true,
  recurring: false,
  expectedAmount: null,
  notes: null,
  matchCount: 3,
  lastMatchedAt: null,
  createdAt: new Date("2026-06-01"),
};

const TEST_DATE = "2026-07-06";
const TEST_CHANNEL = "telegram";

beforeEach(() => {
  vi.clearAllMocks();
  getCategoriesMock.mockResolvedValue([
    { id: "cat-pets", name: "Pets", budgetType: "VARIABLE" },
    { id: "cat-family", name: "Family", budgetType: "VARIABLE" },
  ]);
  createTransactionMock.mockResolvedValue({ id: "txn-1" });
  pendingProposalCreateMock.mockResolvedValue({ id: "proposal-1" });
});

describe("isConfidentTransaction", () => {
  it("is confident when amount is finite and date parses", () => {
    expect(isConfidentTransaction(-45_000, TEST_DATE)).toBe(true);
  });

  it("is not confident when amount is NaN", () => {
    expect(isConfidentTransaction(NaN, TEST_DATE)).toBe(false);
  });

  it("is not confident when amount is Infinity", () => {
    expect(isConfidentTransaction(Infinity, TEST_DATE)).toBe(false);
  });

  it("is not confident when date does not parse", () => {
    expect(isConfidentTransaction(-1000, "not-a-date")).toBe(false);
  });
});

describe("autoRecordFromRule", () => {
  it("creates the transaction using the RULE's category and wallet, not the message's", async () => {
    await autoRecordFromRule({
      amount: -45_000,
      date: TEST_DATE,
      note: "Transferencia",
      rule: RULE,
      channel: TEST_CHANNEL,
    });

    expect(createTransactionMock).toHaveBeenCalledWith({
      amount: -45_000,
      date: new Date(TEST_DATE),
      appCategoryId: "cat-pets",
      wallet: "Investments",
      walletId: undefined,
      note: "Transferencia",
    });
  });

  it("passes the rule's resolved walletId through when set, bypassing name-based resolution", async () => {
    await autoRecordFromRule({
      amount: -45_000,
      date: TEST_DATE,
      note: "Transferencia",
      rule: { ...RULE, walletId: "wallet-1" },
      channel: TEST_CHANNEL,
    });

    expect(createTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({ walletId: "wallet-1" }),
    );
  });

  it("bumps the rule's matchCount/lastMatchedAt", async () => {
    await autoRecordFromRule({
      amount: -45_000,
      date: TEST_DATE,
      rule: RULE,
      channel: TEST_CHANNEL,
    });

    expect(bumpMock).toHaveBeenCalledWith("rule-1");
  });

  it("persists an already-approved PendingProposal with createdId (the undoAddTransaction shape)", async () => {
    await autoRecordFromRule({
      amount: -45_000,
      date: TEST_DATE,
      rule: RULE,
      channel: TEST_CHANNEL,
    });

    expect(pendingProposalCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "propose_add_transaction",
        status: "approved",
        channel: TEST_CHANNEL,
        params: expect.objectContaining({
          appCategoryId: "cat-pets",
          wallet: "Investments",
          createdId: "txn-1",
        }),
      }),
    });
  });

  it("returns the created transactionId, proposalId, and a human-readable message", async () => {
    const result = await autoRecordFromRule({
      amount: -45_000,
      date: TEST_DATE,
      rule: RULE,
      channel: TEST_CHANNEL,
    });

    expect(result.transactionId).toBe("txn-1");
    expect(result.proposalId).toBe("proposal-1");
    expect(result.message).toContain("Pets");
  });
});
