// @vitest-environment node
//
// Unit tests for the wallet-label resolver (ADR-036/037, HANDOFF §3b).
// db.wallet.findMany / db.savingsAccount.findMany are mocked per test so each
// case controls exactly which wallets/accounts exist.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    wallet: { findMany: vi.fn() },
    savingsAccount: { findMany: vi.fn() },
  },
}));

import { db } from "@/lib/db";
import { buildWalletResolver, resolveWalletId } from "./resolve-wallet";

function mockCatalog(
  wallets: { id: string; name: string }[],
  accounts: { name: string; defaultWalletId: string | null }[],
) {
  vi.mocked(db.wallet.findMany).mockResolvedValue(wallets as never);
  vi.mocked(db.savingsAccount.findMany).mockResolvedValue(accounts as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildWalletResolver — wallet-name match", () => {
  it("resolves an exact wallet-name match", async () => {
    mockCatalog([{ id: "w-savings", name: "savings" }], []);
    const resolve = await buildWalletResolver();
    expect(resolve("savings")).toBe("w-savings");
  });

  it("resolves a wallet-name match case-insensitively", async () => {
    mockCatalog([{ id: "w-savings", name: "savings" }], []);
    const resolve = await buildWalletResolver();
    expect(resolve("Savings")).toBe("w-savings");
    expect(resolve("SAVINGS")).toBe("w-savings");
  });
});

describe("buildWalletResolver — defaultWalletId fallback", () => {
  it("falls back to the account's defaultWalletId when the label names a multi-partition institution", async () => {
    // "Bancolombia" itself isn't a wallet name — its wallets are named
    // "debit/daily" and "savings" — so the label only matches the account.
    mockCatalog(
      [
        { id: "w-debit", name: "debit/daily" },
        { id: "w-savings", name: "savings" },
      ],
      [{ name: "Bancolombia", defaultWalletId: "w-debit" }],
    );
    const resolve = await buildWalletResolver();
    expect(resolve("Bancolombia")).toBe("w-debit");
    expect(resolve("bancolombia")).toBe("w-debit"); // case-insensitive
  });
});

describe("buildWalletResolver — no match", () => {
  it("returns null when the label matches neither a wallet nor an account name", async () => {
    mockCatalog(
      [{ id: "w-nequi", name: "Nequi" }],
      [{ name: "Nequi", defaultWalletId: "w-nequi" }],
    );
    const resolve = await buildWalletResolver();
    expect(resolve("Unknown Label")).toBeNull();
  });
});

describe("buildWalletResolver — precedence", () => {
  it("prefers a wallet-name match over an account's defaultWalletId when a label could match both", async () => {
    // A wallet literally named "Investments" exists, AND a *different*
    // account is also named "Investments" with its own defaultWalletId.
    // The wallet-name match must win (checked first in the resolver).
    mockCatalog(
      [{ id: "w-investments", name: "Investments" }],
      [{ name: "Investments", defaultWalletId: "w-account-default" }],
    );
    const resolve = await buildWalletResolver();
    expect(resolve("Investments")).toBe("w-investments");
  });
});

describe("resolveWalletId — one-shot convenience wrapper", () => {
  it("prefetches and resolves in a single call", async () => {
    mockCatalog([{ id: "w-savings", name: "savings" }], []);
    await expect(resolveWalletId("savings")).resolves.toBe("w-savings");
  });

  it("returns null for a one-shot call with no match", async () => {
    mockCatalog([], []);
    await expect(resolveWalletId("nothing")).resolves.toBeNull();
  });
});
