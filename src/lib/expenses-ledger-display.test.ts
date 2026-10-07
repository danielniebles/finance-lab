import { describe, it, expect } from "vitest";
import {
  activeFilters,
  moreFiltersCount,
  resolveLedgerWallet,
  transactionCountLabel,
  walletChips,
  type WalletChipOption,
} from "./expenses-ledger-display";

const w = (id: string): WalletChipOption => ({ id, name: id, color: null });
const WALLETS = ["a", "b", "c", "d", "e", "f"].map(w);
const ids = (list: WalletChipOption[]) => list.map((x) => x.id);

describe("walletChips", () => {
  it("keeps the given order when nothing has activity", () => {
    const { visible, more } = walletChips(WALLETS, {}, undefined);
    expect(ids(visible)).toEqual(["a", "b", "c", "d"]);
    expect(ids(more)).toEqual(["e", "f"]);
  });

  it("puts active wallets first, most transactions first, ties in given order", () => {
    const { visible } = walletChips(WALLETS, { f: 9, c: 2, e: 2 }, undefined);
    expect(ids(visible)).toEqual(["f", "c", "e", "a"]);
  });

  it("keeps the selected wallet visible even when it would fall under more", () => {
    const { visible, more } = walletChips(WALLETS, {}, "f");
    expect(ids(visible)).toEqual(["a", "b", "c", "f"]);
    expect(ids(more)).toEqual(["d", "e"]);
  });

  it("has no more list when everything fits", () => {
    const { visible, more } = walletChips(WALLETS.slice(0, 3), {}, "b");
    expect(ids(visible)).toEqual(["a", "b", "c"]);
    expect(more).toEqual([]);
  });
});

describe("resolveLedgerWallet", () => {
  const known = ["daily", "nequi"];

  it("prefers the URL over the cookie", () => {
    expect(resolveLedgerWallet("nequi", "daily", known)).toBe("nequi");
  });

  it("treats an explicit all in the URL as no wallet, even with a cookie", () => {
    expect(resolveLedgerWallet("all", "daily", known)).toBeUndefined();
  });

  it("falls back to the cookie", () => {
    expect(resolveLedgerWallet(undefined, "daily", known)).toBe("daily");
    expect(resolveLedgerWallet(undefined, "all", known)).toBeUndefined();
  });

  it("is none on a first visit or for an unknown id", () => {
    expect(resolveLedgerWallet(undefined, undefined, known)).toBeUndefined();
    expect(resolveLedgerWallet(undefined, "deleted", known)).toBeUndefined();
  });
});

describe("activeFilters", () => {
  it("lists category, type, tag and search in order", () => {
    const list = activeFilters(
      { category: "Supermarket", type: "expense", tagId: "t1", search: "meat" },
      [{ id: "t1", name: "meat" }],
    );
    expect(list.map((f) => f.label)).toEqual(["Supermarket", "Expenses only", "#meat", "“meat”"]);
  });

  it("is empty with no filters", () => {
    expect(activeFilters({}, [])).toEqual([]);
  });
});

describe("moreFiltersCount", () => {
  it("counts only type and tag", () => {
    expect(moreFiltersCount({ category: "x", search: "y" })).toBe(0);
    expect(moreFiltersCount({ type: "income", tagId: "t" })).toBe(2);
  });
});

describe("transactionCountLabel", () => {
  it("shows shown of total only when filtered", () => {
    expect(transactionCountLabel(17, 17, false)).toBe("17");
    expect(transactionCountLabel(2, 17, true)).toBe("2 of 17");
  });
});
