import { describe, expect, it } from "vitest";
import type { DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";
import {
  computeLoanMeta, debtorSubtitle, initials, loanChip, netWorthComposition, sortDebtors, sortLoans,
} from "./loan-display";

const NOW = new Date("2026-10-05T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function loan(over: Partial<LoanWithRemaining> = {}): LoanWithRemaining {
  return {
    id: "l1", debtorId: "d1", accountId: "a1", accountName: "Nu", accountColor: null,
    amount: 1_000_000, date: daysAgo(10), expectedBy: null, notes: null, createdAt: daysAgo(10),
    paid: 0, remaining: 1_000_000, isActive: true, payments: [], linkedTransaction: null, ...over,
  };
}

function debtor(loans: LoanWithRemaining[], name = "Ana"): DebtorWithLoans {
  const totalOwed = loans.reduce((s, l) => s + l.remaining, 0);
  return { id: name, name, notes: null, loans, totalOwed, activeLoansCount: loans.filter((l) => l.isActive).length };
}

describe("computeLoanMeta", () => {
  it("computes repaid share and age", () => {
    const m = computeLoanMeta(loan({ paid: 250_000, date: daysAgo(65) }), NOW);
    expect(m.pct).toBe(25);
    expect(m.ageLabel).toBe("2mo");
  });
  it("flags overdue only for active loans past expectedBy", () => {
    expect(computeLoanMeta(loan({ expectedBy: daysAgo(1) }), NOW).isOverdue).toBe(true);
    expect(computeLoanMeta(loan({ expectedBy: daysAgo(1), isActive: false }), NOW).isOverdue).toBe(false);
  });
  it("flags stale when old and no recent payment", () => {
    expect(computeLoanMeta(loan({ date: daysAgo(200) }), NOW).isStale).toBe(true);
    const paidRecently = loan({ date: daysAgo(200), payments: [{ id: "p", amount: 1, date: daysAgo(5), notes: null }] });
    expect(computeLoanMeta(paidRecently, NOW).isStale).toBe(false);
  });
});

describe("loanChip", () => {
  it("shows no chip for a normal active loan", () => {
    const l = loan();
    expect(loanChip(l, computeLoanMeta(l, NOW))).toBeNull();
  });
  it("calls out overdue and settled", () => {
    const o = loan({ expectedBy: daysAgo(3) });
    expect(loanChip(o, computeLoanMeta(o, NOW))).toEqual({ tone: "danger", label: "Overdue" });
    const s = loan({ isActive: false, remaining: 0 });
    expect(loanChip(s, computeLoanMeta(s, NOW))).toEqual({ tone: "positive", label: "Settled" });
  });
});

describe("debtor helpers", () => {
  it("initials", () => {
    expect(initials("ana maría lópez")).toBe("AM");
    expect(initials("Pedro")).toBe("P");
  });
  it("subtitle names count and oldest active loan", () => {
    const d = debtor([loan({ date: daysAgo(10) }), loan({ id: "l2", date: daysAgo(220) }), loan({ id: "l3", isActive: false, date: daysAgo(900) })]);
    expect(debtorSubtitle(d, NOW)).toBe("2 active loans · oldest 7mo");
    expect(debtorSubtitle(debtor([loan({ isActive: false, remaining: 0 })]), NOW)).toBe("All settled");
  });
  it("sorts debtors by amount owed", () => {
    const a = debtor([loan({ remaining: 10 })], "A");
    const b = debtor([loan({ remaining: 50 })], "B");
    const c = debtor([loan({ remaining: 0, isActive: false })], "C");
    expect(sortDebtors([c, a, b]).map((d) => d.name)).toEqual(["B", "A", "C"]);
  });
  it("sorts loans active-oldest first, then settled newest first", () => {
    const rows = sortLoans([
      loan({ id: "s-old", isActive: false, date: daysAgo(300) }),
      loan({ id: "a-new", date: daysAgo(5) }),
      loan({ id: "s-new", isActive: false, date: daysAgo(20) }),
      loan({ id: "a-old", date: daysAgo(100) }),
    ]);
    expect(rows.map((l) => l.id)).toEqual(["a-old", "a-new", "s-new", "s-old"]);
  });
});

describe("netWorthComposition", () => {
  it("splits into percentages, ignoring negative parts", () => {
    const parts = netWorthComposition({ available: 600, inLoans: 300, inVaults: 100 });
    expect(parts.map((p) => Math.round(p.pct))).toEqual([60, 30, 10]);
    const neg = netWorthComposition({ available: -50, inLoans: 100, inVaults: 0 });
    expect(neg[0].pct).toBe(0);
    expect(neg[1].pct).toBe(100);
  });
});
