// @vitest-environment node
//
// Tests for the wallet-grain refactor of getLoansOverview (ADR-036/037,
// Milestone C1 — HANDOFF §7). Mirrors counterparty-rules.test.ts's
// module-level `vi.mock("@/lib/db", ...)` convention.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    savingsAccount: { findMany: vi.fn() },
    debtor: { findMany: vi.fn() },
    transaction: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { getLoansOverview } from "./loans";

const dbMock = db as unknown as {
  savingsAccount: { findMany: ReturnType<typeof vi.fn> };
  debtor: { findMany: ReturnType<typeof vi.fn> };
  transaction: { findMany: ReturnType<typeof vi.fn> };
};

const OPENING_DATE = new Date("2026-07-09T00:00:00Z");
const SAVINGS_WALLET_ID = "wlt-savings";

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

/** Bancolombia in the day-0 migration placeholder: whole balance parked in "savings". */
function bancolombiaAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc-bancolombia",
    name: "Bancolombia",
    accountType: "BANK" as const,
    color: "#00aa00",
    savingsWalletId: SAVINGS_WALLET_ID,
    defaultWalletId: "wlt-debit",
    wallets: [
      wallet({ id: "wlt-debit", name: "debit/daily", isSavings: false, includeInAvailable: true, openingBalance: 0 }),
      wallet({ id: SAVINGS_WALLET_ID, name: "savings", isSavings: true, includeInAvailable: true, openingBalance: 1_206_614 }),
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

function proteccionAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc-proteccion",
    name: "Protección",
    accountType: "PENSION" as const,
    color: "#aabb00",
    savingsWalletId: "wlt-proteccion",
    defaultWalletId: "wlt-proteccion",
    wallets: [
      wallet({ id: "wlt-proteccion", name: "Protección", includeInAvailable: false, openingBalance: 11_000_000 }),
    ],
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
  dbMock.debtor.findMany.mockResolvedValue([]);
  dbMock.transaction.findMany.mockResolvedValue([]);
});

describe("getLoansOverview — savings figure excludes non-savings wallets", () => {
  it("an account's balance sums only its isSavings wallets, not debit/daily", async () => {
    dbMock.savingsAccount.findMany.mockResolvedValue([bancolombiaAccount()]);
    // A post-epoch expense on the non-savings debit/daily wallet.
    dbMock.transaction.findMany.mockResolvedValue([
      { walletId: "wlt-debit", date: new Date("2026-07-10"), amount: -50_000 },
    ]);

    const overview = await getLoansOverview();

    // debit/daily now has balance -50_000, but the Loans savings figure must
    // not see it — only "savings" (1_206_614) + "investments" (0) count.
    expect(overview.accounts[0].balance).toBe(1_206_614);
  });
});

describe("getLoansOverview — available KPI", () => {
  it("available = Σ wallet.balance WHERE isSavings && includeInAvailable (Protección/investments excluded)", async () => {
    dbMock.savingsAccount.findMany.mockResolvedValue([bancolombiaAccount(), nuAccount(), proteccionAccount()]);

    const overview = await getLoansOverview();

    // Bancolombia: only "savings" counts (investments is includeInAvailable=false, debit/daily isSavings=false).
    // Protección is entirely excluded (includeInAvailable=false).
    expect(overview.available).toBe(1_206_614 + 500_000);
  });
});

describe("getLoansOverview — continuity across the migration (ADR-037)", () => {
  it("available is continuous under the all-in-savings placeholder (matches the pre-split whole-account total)", async () => {
    dbMock.savingsAccount.findMany.mockResolvedValue([bancolombiaAccount()]);

    const overview = await getLoansOverview();

    // Pre-migration, Bancolombia was a single includeInAvailable=true account
    // whose whole balance (1_206_614) counted toward `available`. Under the
    // placeholder (whole balance parked in "savings"), that figure must be
    // unchanged.
    expect(overview.available).toBe(1_206_614);
  });

  it("once the real debit/investments splits are entered, available decreases by exactly those two wallets' balances", async () => {
    dbMock.savingsAccount.findMany.mockResolvedValue([bancolombiaAccount()]);
    const beforeOverview = await getLoansOverview();

    const debitBalance = 300_000;
    const investBalance = 200_000;
    const savingsBalance = 1_206_614 - debitBalance - investBalance; // grand total held constant

    dbMock.savingsAccount.findMany.mockResolvedValue([
      bancolombiaAccount({
        wallets: [
          wallet({ id: "wlt-debit", name: "debit/daily", isSavings: false, includeInAvailable: true, openingBalance: debitBalance }),
          wallet({ id: SAVINGS_WALLET_ID, name: "savings", isSavings: true, includeInAvailable: true, openingBalance: savingsBalance }),
          wallet({ id: "wlt-invest", name: "investments", isSavings: true, includeInAvailable: false, openingBalance: investBalance }),
        ],
      }),
    ]);
    const afterOverview = await getLoansOverview();

    expect(beforeOverview.available - afterOverview.available).toBe(debitBalance + investBalance);
  });
});

describe("getLoansOverview — the double-count guard applies to loan/vault flows too", () => {
  it("a Loan dated BEFORE the wallet's openingDate does not reduce the balance", async () => {
    dbMock.savingsAccount.findMany.mockResolvedValue([
      bancolombiaAccount({
        loansGiven: [
          { id: "loan-1", walletId: SAVINGS_WALLET_ID, amount: 900_000, date: new Date("2026-01-01"), payments: [] },
        ],
      }),
    ]);

    const overview = await getLoansOverview();

    expect(overview.accounts[0].balance).toBe(1_206_614); // unaffected — pre-epoch
  });

  it("a Loan dated ON/AFTER the wallet's openingDate DOES reduce the balance", async () => {
    dbMock.savingsAccount.findMany.mockResolvedValue([
      bancolombiaAccount({
        loansGiven: [
          { id: "loan-1", walletId: SAVINGS_WALLET_ID, amount: 900_000, date: new Date("2026-07-10"), payments: [] },
        ],
      }),
    ]);

    const overview = await getLoansOverview();

    expect(overview.accounts[0].balance).toBe(1_206_614 - 900_000);
  });

  it("a VaultEntry dated BEFORE the wallet's openingDate does not reduce the balance", async () => {
    dbMock.savingsAccount.findMany.mockResolvedValue([
      bancolombiaAccount({
        vaultEntriesFunded: [
          { id: "ve-1", sourceWalletId: SAVINGS_WALLET_ID, amount: 400_000, date: new Date("2026-01-01"), vault: { name: "Trip" } },
        ],
      }),
    ]);

    const overview = await getLoansOverview();

    expect(overview.accounts[0].balance).toBe(1_206_614); // unaffected — pre-epoch
  });

  it("a VaultEntry dated ON/AFTER the wallet's openingDate DOES reduce the balance", async () => {
    dbMock.savingsAccount.findMany.mockResolvedValue([
      bancolombiaAccount({
        vaultEntriesFunded: [
          { id: "ve-1", sourceWalletId: SAVINGS_WALLET_ID, amount: 400_000, date: new Date("2026-07-09"), vault: { name: "Trip" } },
        ],
      }),
    ]);

    const overview = await getLoansOverview();

    expect(overview.accounts[0].balance).toBe(1_206_614 - 400_000);
  });
});
