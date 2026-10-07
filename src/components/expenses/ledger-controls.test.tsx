// Unit tests for LedgerControls' buildLedgerUrl pure function (ADR-035) — the
// single URL-building mechanism every control on the Ledger tab drives
// (category chips, search, More filters, active-filters line), all via the
// same router.push contract PeriodSelector already established.

import { describe, it, expect } from "vitest";
import { buildLedgerUrl } from "./ledger-controls";
import type { LedgerFilters } from "@/lib/queries/transactions";

const NO_FILTERS: LedgerFilters = {};

describe("buildLedgerUrl", () => {
  it("never writes groupBy (the ledger always groups by day)", () => {
    const url = buildLedgerUrl(7, 2026, NO_FILTERS, {});
    expect(url).not.toContain("groupBy=");
  });

  it("writes an explicit walletId=all when no wallet is selected", () => {
    const url = buildLedgerUrl(7, 2026, NO_FILTERS, {});
    expect(url).toBe("/expenses?view=ledger&month=7&year=2026&walletId=all");
  });

  it("adds a category filter param when patched", () => {
    const url = buildLedgerUrl(7, 2026, NO_FILTERS, { category: "Groceries" });
    expect(url).toContain("category=Groceries");
  });

  it("adds a walletId filter param when patched", () => {
    const url = buildLedgerUrl(7, 2026, NO_FILTERS, { walletId: "wlt_nequi" });
    expect(url).toContain("walletId=wlt_nequi");
  });

  it("adds a type filter param when patched", () => {
    const url = buildLedgerUrl(7, 2026, NO_FILTERS, { type: "expense" });
    expect(url).toContain("type=expense");
  });

  it("adds a search filter param when patched", () => {
    const url = buildLedgerUrl(7, 2026, NO_FILTERS, { search: "uber" });
    expect(url).toContain("search=uber");
  });

  it("adds a tagId filter param when patched", () => {
    const url = buildLedgerUrl(7, 2026, NO_FILTERS, { tagId: "tag-uber" });
    expect(url).toContain("tagId=tag-uber");
  });

  it("preserves an existing filter not present in the patch", () => {
    const filters: LedgerFilters = { category: "Groceries", walletId: "wlt_nequi" };
    const url = buildLedgerUrl(7, 2026, filters, { search: "uber" });
    expect(url).toContain("category=Groceries");
    expect(url).toContain("walletId=wlt_nequi");
    expect(url).toContain("search=uber");
  });

  it("clearing a filter (patch value of empty string) removes it but keeps the wallet", () => {
    const filters: LedgerFilters = { category: "Groceries", walletId: "wlt_nequi" };
    const url = buildLedgerUrl(7, 2026, filters, { category: "" });
    expect(url).not.toContain("category=");
    expect(url).toContain("walletId=wlt_nequi");
  });

  it("always includes view=ledger, month, and year", () => {
    const url = buildLedgerUrl(3, 2027, NO_FILTERS, {});
    expect(url).toContain("view=ledger");
    expect(url).toContain("month=3");
    expect(url).toContain("year=2027");
  });
});
