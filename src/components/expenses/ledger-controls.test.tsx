// Unit tests for LedgerControls' buildLedgerUrl pure function (ADR-035) — the
// single URL-building mechanism every control on the Ledger tab's filter bar
// drives (groupBy toggle + category/wallet/type/search filters), all via the
// same router.push contract PeriodSelector already established. Tested in
// isolation from the component since it's a pure function of
// (month, year, groupBy, filters, patch) → url string.

import { describe, it, expect } from "vitest";
import { buildLedgerUrl } from "./ledger-controls";
import type { LedgerFilters } from "@/lib/queries/transactions";

const NO_FILTERS: LedgerFilters = {};

describe("buildLedgerUrl", () => {
  it("omits groupBy from the URL when it's the default (day)", () => {
    const url = buildLedgerUrl(7, 2026, "day", NO_FILTERS, {});
    expect(url).toBe("/expenses?view=ledger&month=7&year=2026");
  });

  it("includes groupBy when patched to a non-default value", () => {
    const url = buildLedgerUrl(7, 2026, "day", NO_FILTERS, { groupBy: "category" });
    expect(url).toContain("groupBy=category");
  });

  it("omits groupBy again when patched back to day from a non-default current value", () => {
    const url = buildLedgerUrl(7, 2026, "category", NO_FILTERS, { groupBy: "day" });
    expect(url).not.toContain("groupBy=");
  });

  it("adds a category filter param when patched", () => {
    const url = buildLedgerUrl(7, 2026, "day", NO_FILTERS, { category: "Groceries" });
    expect(url).toContain("category=Groceries");
  });

  it("adds a walletId filter param when patched", () => {
    const url = buildLedgerUrl(7, 2026, "day", NO_FILTERS, { walletId: "wlt_nequi" });
    expect(url).toContain("walletId=wlt_nequi");
  });

  it("adds a type filter param when patched", () => {
    const url = buildLedgerUrl(7, 2026, "day", NO_FILTERS, { type: "expense" });
    expect(url).toContain("type=expense");
  });

  it("adds a search filter param when patched", () => {
    const url = buildLedgerUrl(7, 2026, "day", NO_FILTERS, { search: "uber" });
    expect(url).toContain("search=uber");
  });

  it("preserves an existing filter not present in the patch", () => {
    const filters: LedgerFilters = { category: "Groceries", walletId: "wlt_nequi" };
    const url = buildLedgerUrl(7, 2026, "day", filters, { search: "uber" });
    expect(url).toContain("category=Groceries");
    expect(url).toContain("walletId=wlt_nequi");
    expect(url).toContain("search=uber");
  });

  it("clearing a filter (patch value of empty string) removes it from the URL", () => {
    const filters: LedgerFilters = { category: "Groceries", walletId: "wlt_nequi" };
    const url = buildLedgerUrl(7, 2026, "day", filters, { category: "" });
    expect(url).not.toContain("category=");
    expect(url).toContain("walletId=wlt_nequi");
  });

  it("always includes view=ledger, month, and year", () => {
    const url = buildLedgerUrl(3, 2027, "wallet", NO_FILTERS, {});
    expect(url).toContain("view=ledger");
    expect(url).toContain("month=3");
    expect(url).toContain("year=2027");
  });
});
