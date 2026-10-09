import { describe, it, expect } from "vitest";
import {
  accountsWithOpenLoans,
  allocatePayment,
  loanAmountError,
  loanMissingHint,
  nextTransferTarget,
  paymentMissingHint,
  signedEntryAmount,
  transferMissingHint,
} from "./loan-forms";
import type { AccountWithBalance, DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";

function loan(id: string, accountId: string, date: string, remaining: number, isActive = remaining > 0): LoanWithRemaining {
  return {
    id,
    debtorId: "d1",
    accountId,
    accountName: accountId,
    accountColor: null,
    amount: remaining + 100,
    date: new Date(`${date}T12:00:00`),
    expectedBy: null,
    notes: null,
    createdAt: new Date(`${date}T12:00:00`),
    paid: 100,
    remaining,
    isActive,
    payments: [],
    linkedTransaction: null, installmentSlots: 0,
  };
}

const DEBTOR: DebtorWithLoans = {
  id: "d1",
  name: "Maria",
  notes: null,
  loans: [
    loan("old", "a1", "2026-01-10", 300),
    loan("new", "a1", "2026-06-10", 200),
    loan("other", "a2", "2026-03-10", 500),
    loan("settled", "a3", "2026-07-10", 0),
  ],
  totalOwed: 1000,
  activeLoansCount: 3,
};

describe("allocatePayment", () => {
  it("pays the newest loan first, across all accounts", () => {
    const r = allocatePayment(DEBTOR, "", 600);
    expect(r.splits.map((s) => [s.loan.id, s.apply])).toEqual([
      ["new", 200],
      ["other", 400],
    ]);
    expect(r.owed).toBe(1000);
    expect(r.unallocated).toBe(0);
  });

  it("keeps to one account when one is picked", () => {
    const r = allocatePayment(DEBTOR, "a1", 250);
    expect(r.splits.map((s) => [s.loan.id, s.apply])).toEqual([
      ["new", 200],
      ["old", 50],
    ]);
    expect(r.owed).toBe(500);
  });

  it("reports what no loan can take", () => {
    expect(allocatePayment(DEBTOR, "a1", 800).unallocated).toBe(300);
  });

  it("returns nothing to split without a debtor or a positive amount", () => {
    expect(allocatePayment(undefined, "", 100)).toEqual({ splits: [], owed: 0, unallocated: 0 });
    expect(allocatePayment(DEBTOR, "", NaN).splits).toEqual([]);
    expect(allocatePayment(DEBTOR, "", 0).owed).toBe(1000);
  });
});

describe("accountsWithOpenLoans", () => {
  it("lists only accounts with an active loan", () => {
    const accounts = ["a1", "a2", "a3"].map((id) => ({ id }) as AccountWithBalance);
    expect(accountsWithOpenLoans(DEBTOR, accounts).map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(accountsWithOpenLoans(undefined, accounts)).toEqual([]);
  });
});

describe("paymentMissingHint", () => {
  const ok = { splits: [], owed: 1000, unallocated: 0 };
  it("asks for the debtor, then the amount", () => {
    expect(paymentMissingHint("", 100, ok)).toBe("Pick who paid.");
    expect(paymentMissingHint("d1", NaN, ok)).toBe("Add the amount received.");
  });
  it("blocks paying more than is owed", () => {
    expect(paymentMissingHint("d1", 1200, { ...ok, unallocated: 200 })).toBe("That's more than they owe.");
  });
  it("is empty when ready", () => {
    expect(paymentMissingHint("d1", 100, ok)).toBe("");
  });
});

describe("transfers", () => {
  it("needs two different accounts and an amount", () => {
    expect(transferMissingHint("", "a2", 1)).toBe("Pick both accounts.");
    expect(transferMissingHint("a1", "a1", 1)).toBe("Pick two different accounts.");
    expect(transferMissingHint("a1", "a2", 0)).toBe("Add an amount.");
    expect(transferMissingHint("a1", "a2", 5)).toBe("");
  });

  it("moves the destination off the new source", () => {
    const accounts = [{ id: "a1" }, { id: "a2" }, { id: "a3" }];
    expect(nextTransferTarget("a2", "a3", accounts)).toBe("a3");
    expect(nextTransferTarget("a2", "a2", accounts)).toBe("a1");
    expect(nextTransferTarget("a1", "", [{ id: "a1" }])).toBe("");
  });
});

describe("loan form", () => {
  it("won't edit a loan below what's been repaid", () => {
    const l = { ...loan("x", "a1", "2026-01-01", 400), amount: 1000, paid: 600 };
    expect(loanAmountError(500, l)).toBe("Less than what's already been repaid.");
    expect(loanAmountError(600, l)).toBeUndefined();
    expect(loanAmountError(10, null)).toBeUndefined();
  });

  it("asks for debtor, account, then amount", () => {
    expect(loanMissingHint({ debtorId: "", accountId: "a", amount: "5" })).toBe("Pick who you lent to.");
    expect(loanMissingHint({ debtorId: "d", accountId: "", amount: "5" })).toBe("Pick the account it came from.");
    expect(loanMissingHint({ debtorId: "d", accountId: "a", amount: "" })).toBe("Add an amount.");
    expect(loanMissingHint({ debtorId: "d", accountId: "a", amount: "5" })).toBe("");
  });
});

describe("signedEntryAmount", () => {
  it("signs by direction", () => {
    expect(signedEntryAmount("1500", "add")).toBe(1500);
    expect(signedEntryAmount("1500", "deduct")).toBe(-1500);
    expect(signedEntryAmount("", "add")).toBeNaN();
  });
});
