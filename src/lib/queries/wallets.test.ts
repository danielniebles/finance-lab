// @vitest-environment node
//
// Tests for getWalletBalances() (ADR-036/037, Milestone C1). Mirrors
// counterparty-rules.test.ts's module-level `vi.mock("@/lib/db", ...)`
// convention.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    savingsAccount: { findMany: vi.fn() },
    transaction: { findMany: vi.fn() },
    wallet: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { getWalletBalances, listWalletOptions } from "./wallets";

const dbMock = db as unknown as {
  savingsAccount: { findMany: ReturnType<typeof vi.fn> };
  transaction: { findMany: ReturnType<typeof vi.fn> };
  wallet: { findMany: ReturnType<typeof vi.fn> };
};

const OPENING_DATE = new Date("2026-07-09T00:00:00Z");

function wallet(overrides: Record<string, unknown> = {}) {
  return {
    id: "wlt-default",
    name: "default",
    color: null,
    sortOrder: 0,
    isSavings: true,
    includeInAvailable: true,
    openingBalance: 0,
    openingDate: OPENING_DATE,
    ...overrides,
  };
}

/** A Bancolombia-shaped account: 3 partitions, whole balance parked in "savings" (the migration placeholder). */
function bancolombiaAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc-bancolombia",
    name: "Bancolombia",
    accountType: "BANK" as const,
    color: "#00aa00",
    savingsWalletId: "wlt-savings",
    defaultWalletId: "wlt-debit",
    wallets: [
      wallet({ id: "wlt-debit", name: "debit/daily", isSavings: false, includeInAvailable: true, openingBalance: 0 }),
      wallet({ id: "wlt-savings", name: "savings", isSavings: true, includeInAvailable: true, openingBalance: 1_206_614 }),
      wallet({ id: "wlt-invest", name: "investments", isSavings: true, includeInAvailable: false, openingBalance: 0 }),
    ],
    entries: [],
    loansGiven: [],
    transfersFrom: [],
    transfersTo: [],
    vaultEntriesFunded: [],
    ...overrides,
  };
}

/** A plain single-wallet account (Nu-shaped). */
function nuAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc-nu",
    name: "Nu",
    accountType: "DIGITAL" as const,
    color: "#aa00aa",
    savingsWalletId: "wlt-nu",
    defaultWalletId: "wlt-nu",
    wallets: [wallet({ id: "wlt-nu", name: "Nu", openingBalance: 500_000 })],
    entries: [],
    loansGiven: [],
    transfersFrom: [],
    transfersTo: [],
    vaultEntriesFunded: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getWalletBalances — grand total", () => {
  it("grandTotal = Σ ALL wallet.balance, including the non-savings debit/daily wallet", async () => {
    dbMock.savingsAccount.findMany.mockResolvedValue([bancolombiaAccount(), nuAccount()]);
    dbMock.transaction.findMany.mockResolvedValue([]);

    const result = await getWalletBalances();

    // Bancolombia: 0 (debit) + 1_206_614 (savings) + 0 (investments) = 1_206_614
    // Nu: 500_000
    expect(result.grandTotal).toBe(1_206_614 + 500_000);
  });

  it("includes a post-epoch transaction attributed to its wallet via walletId", async () => {
    dbMock.savingsAccount.findMany.mockResolvedValue([bancolombiaAccount()]);
    dbMock.transaction.findMany.mockResolvedValue([
      { walletId: "wlt-debit", date: new Date("2026-07-10"), amount: -50_000 }, // post-epoch expense on debit/daily
    ]);

    const result = await getWalletBalances();

    const debitWallet = result.accounts[0].wallets.find((w) => w.name === "debit/daily");
    expect(debitWallet?.balance).toBe(-50_000);
    expect(result.grandTotal).toBe(1_206_614 - 50_000);
  });

  it("a transaction dated BEFORE the wallet's openingDate does not move its balance", async () => {
    dbMock.savingsAccount.findMany.mockResolvedValue([bancolombiaAccount()]);
    dbMock.transaction.findMany.mockResolvedValue([
      { walletId: "wlt-savings", date: new Date("2026-01-01"), amount: -999_999 }, // pre-epoch — already baked into openingBalance
    ]);

    const result = await getWalletBalances();

    const savingsWallet = result.accounts[0].wallets.find((w) => w.name === "savings");
    expect(savingsWallet?.balance).toBe(1_206_614);
  });
});

describe("getWalletBalances — per-account rollup", () => {
  it("an account's balance is the sum of its own wallets", async () => {
    dbMock.savingsAccount.findMany.mockResolvedValue([bancolombiaAccount()]);
    dbMock.transaction.findMany.mockResolvedValue([]);

    const result = await getWalletBalances();

    expect(result.accounts[0].balance).toBe(1_206_614);
    expect(result.accounts[0].wallets).toHaveLength(3);
  });
});

describe("listWalletOptions", () => {
  it("returns plain {id, name} pairs via a cheap findMany, not the full balance computation", async () => {
    dbMock.wallet.findMany.mockResolvedValue([
      { id: "wlt-a", name: "debit/daily" },
      { id: "wlt-b", name: "savings" },
    ]);

    const result = await listWalletOptions();

    expect(result).toEqual([
      { id: "wlt-a", name: "debit/daily" },
      { id: "wlt-b", name: "savings" },
    ]);
    expect(dbMock.wallet.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    });
    expect(dbMock.savingsAccount.findMany).not.toHaveBeenCalled();
    expect(dbMock.transaction.findMany).not.toHaveBeenCalled();
  });
});
