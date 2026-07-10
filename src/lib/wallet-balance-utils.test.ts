// @vitest-environment node
//
// Unit tests for the pure wallet balance math (ADR-036/037, Milestone C1).
// No DB — computeWalletBalance/groupByWalletId are pure functions.

import { describe, it, expect } from "vitest";
import { computeWalletBalance, groupByWalletId, type WalletBalanceInputs } from "./wallet-balance-utils";

const OPENING_DATE = new Date("2026-07-09T00:00:00Z");

function emptyInputs(overrides: Partial<WalletBalanceInputs> = {}): WalletBalanceInputs {
  return {
    openingBalance: 0,
    openingDate: OPENING_DATE,
    transactions: [],
    loansGiven: [],
    loanPayments: [],
    vaultFunded: [],
    accountEntries: [],
    transfersIn: [],
    transfersOut: [],
    ...overrides,
  };
}

describe("computeWalletBalance — continuity", () => {
  it("balance equals openingBalance when there are no post-epoch flows at all", () => {
    const balance = computeWalletBalance(emptyInputs({ openingBalance: 1_206_614 }));
    expect(balance).toBe(1_206_614);
  });
});

describe("computeWalletBalance — the openingDate epoch guard", () => {
  it("a flow dated BEFORE openingDate does not move the balance (already baked into openingBalance)", () => {
    const before = new Date("2026-06-01T00:00:00Z"); // before OPENING_DATE
    const balance = computeWalletBalance(
      emptyInputs({
        openingBalance: 1_000_000,
        loansGiven: [{ date: before, amount: 500_000 }],
      }),
    );
    expect(balance).toBe(1_000_000);
  });

  it("a flow dated ON/AFTER openingDate DOES move the balance", () => {
    const onEpoch = new Date("2026-07-09T00:00:00Z"); // === OPENING_DATE
    const after = new Date("2026-07-10T00:00:00Z");
    const balance = computeWalletBalance(
      emptyInputs({
        openingBalance: 1_000_000,
        loansGiven: [
          { date: onEpoch, amount: 200_000 },
          { date: after, amount: 100_000 },
        ],
      }),
    );
    expect(balance).toBe(1_000_000 - 200_000 - 100_000);
  });
});

describe("computeWalletBalance — flow term signs", () => {
  it("transactions add signed amount (income +, expense −)", () => {
    const balance = computeWalletBalance(
      emptyInputs({
        openingBalance: 0,
        transactions: [
          { date: OPENING_DATE, amount: 500_000 }, // income
          { date: OPENING_DATE, amount: -80_000 }, // expense
        ],
      }),
    );
    expect(balance).toBe(420_000);
  });

  it("loansGiven subtracts, loanPayments adds back", () => {
    const balance = computeWalletBalance(
      emptyInputs({
        openingBalance: 1_000_000,
        loansGiven: [{ date: OPENING_DATE, amount: 300_000 }],
        loanPayments: [{ date: OPENING_DATE, amount: 100_000 }],
      }),
    );
    expect(balance).toBe(1_000_000 - 300_000 + 100_000);
  });

  it("vaultFunded subtracts (money earmarked out)", () => {
    const balance = computeWalletBalance(
      emptyInputs({ openingBalance: 500_000, vaultFunded: [{ date: OPENING_DATE, amount: 200_000 }] }),
    );
    expect(balance).toBe(300_000);
  });

  it("accountEntries add (signed), transfersIn add, transfersOut subtract", () => {
    const balance = computeWalletBalance(
      emptyInputs({
        openingBalance: 0,
        accountEntries: [{ date: OPENING_DATE, amount: -50_000 }],
        transfersIn: [{ date: OPENING_DATE, amount: 200_000 }],
        transfersOut: [{ date: OPENING_DATE, amount: 30_000 }],
      }),
    );
    expect(balance).toBe(-50_000 + 200_000 - 30_000);
  });
});

describe("groupByWalletId", () => {
  it("buckets rows by walletId and drops rows with a null walletId", () => {
    const groups = groupByWalletId([
      { walletId: "w1", date: OPENING_DATE, amount: 100 },
      { walletId: "w2", date: OPENING_DATE, amount: 200 },
      { walletId: "w1", date: OPENING_DATE, amount: 50 },
      { walletId: null, date: OPENING_DATE, amount: 999 },
    ]);

    expect(groups.get("w1")).toEqual([
      { date: OPENING_DATE, amount: 100 },
      { date: OPENING_DATE, amount: 50 },
    ]);
    expect(groups.get("w2")).toEqual([{ date: OPENING_DATE, amount: 200 }]);
    expect(groups.has("__no_wallet__")).toBe(false);
    expect([...groups.values()].flat()).toHaveLength(3); // the null-walletId row was dropped
  });

  it("returns an empty map for an empty list", () => {
    expect(groupByWalletId([]).size).toBe(0);
  });
});
