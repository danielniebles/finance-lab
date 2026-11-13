import { describe, expect, it } from "vitest";
import {
  accountSubtitle,
  openingBalanceFromParts,
  openingBalanceParts,
  walletDeleteBlocker,
  walletRoleChips,
  type WalletSettingsRow,
} from "./wallet-settings-display";

const NO_USAGE = { transactions: 0, loans: 0, vaultEntries: 0, rules: 0 };

function wallet(over: Partial<WalletSettingsRow> = {}): WalletSettingsRow {
  return {
    id: "w1",
    name: "Savings",
    color: null,
    sortOrder: 0,
    isSavings: true,
    includeInAvailable: true,
    openingBalance: 0,
    openingDate: new Date(2026, 0, 1, 12),
    balance: 0,
    isMain: false,
    isDefault: false,
    usage: NO_USAGE,
    ...over,
  };
}

describe("walletRoleChips", () => {
  it("lists savings, available, default and main in that order", () => {
    const chips = walletRoleChips(wallet({ isMain: true, isDefault: true }), 1);
    expect(chips.map((c) => c.label)).toEqual(["Savings", "Available", "Default", "Main"]);
  });

  it("uses the long labels when the account has several wallets", () => {
    const chips = walletRoleChips(wallet({ isSavings: false, isDefault: true, isMain: true }), 3);
    expect(chips.map((c) => c.label)).toEqual(["Default for new transactions", "Main · entries & transfers"]);
  });

  it("never shows available for a non-savings wallet", () => {
    expect(walletRoleChips(wallet({ isSavings: false, includeInAvailable: true }), 2)).toEqual([]);
  });
});

describe("walletDeleteBlocker", () => {
  it("keeps an account's last wallet", () => {
    expect(walletDeleteBlocker(wallet(), 1)).toMatch(/at least one wallet/);
  });

  it("keeps the main and the default wallet", () => {
    expect(walletDeleteBlocker(wallet({ isMain: true }), 2)).toMatch(/entries and transfers/);
    expect(walletDeleteBlocker(wallet({ isDefault: true }), 2)).toMatch(/default wallet/);
  });

  it("names what still uses the wallet", () => {
    const usage = { transactions: 3, loans: 1, vaultEntries: 0, rules: 2 };
    expect(walletDeleteBlocker(wallet({ usage }), 2)).toBe(
      "It still has 3 transactions, 1 loan and 2 rules. Move or delete those first.",
    );
  });

  it("allows an unused, unpinned wallet", () => {
    expect(walletDeleteBlocker(wallet(), 2)).toBeNull();
  });
});

describe("accountSubtitle", () => {
  it("counts wallets, or says the account is out of the Home total", () => {
    expect(accountSubtitle({ accountType: "BANK", includeInOverviewTotal: true, wallets: [wallet(), wallet()] })).toBe(
      "Bank · 2 wallets",
    );
    expect(accountSubtitle({ accountType: "PENSION", includeInOverviewTotal: false, wallets: [wallet()] })).toBe(
      "AFP · not in Home total",
    );
  });
});

describe("opening balance parts", () => {
  it("round-trips signed amounts", () => {
    expect(openingBalanceParts(-250000)).toEqual({ digits: "250000", negative: true });
    expect(openingBalanceParts(0)).toEqual({ digits: "", negative: false });
    expect(openingBalanceFromParts("250000", true)).toBe(-250000);
    expect(openingBalanceFromParts("", false)).toBe(0);
  });
});
