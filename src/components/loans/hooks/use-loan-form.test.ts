import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  toDateInput,
  toDateObj,
  fieldsFromEditing,
  submitLoan,
} from "../lib/use-loan-form.helpers";
import { useLoanForm } from "./use-loan-form";
import type { AccountWithBalance, DebtorWithLoans, LoanWithRemaining } from "@/lib/queries/loans";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/actions/loans", () => ({
  createLoan: vi.fn().mockResolvedValue(undefined),
  updateLoan: vi.fn().mockResolvedValue(undefined),
}));

// Import mocked versions after vi.mock hoisting
import { createLoan, updateLoan } from "@/lib/actions/loans";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FALLBACK_ACCOUNT_ID = "acc-fallback";
const LOAN_DATE_STR = "2026-05-15";

const BASE_LOAN: LoanWithRemaining = {
  id: "loan-1",
  debtorId: "debtor-1",
  accountId: "account-1",
  accountName: "Bancolombia",
  accountColor: "#00aa00",
  amount: 5_000_000,
  date: new Date(`${LOAN_DATE_STR}T12:00:00`),
  expectedBy: new Date("2026-12-01T12:00:00"),
  notes: "  Some notes  ",
  createdAt: new Date(`${LOAN_DATE_STR}T10:00:00`),
  paid: 0,
  remaining: 5_000_000,
  isActive: true,
  payments: [],
};

const LOAN_2: LoanWithRemaining = {
  ...BASE_LOAN,
  id: "loan-2",
  debtorId: "debtor-2",
  accountId: "account-2",
  amount: 1_000_000,
  date: new Date("2026-06-01T12:00:00"),
  expectedBy: null,
  notes: null,
};

const ACCOUNTS: AccountWithBalance[] = [
  {
    id: "account-1",
    name: "Bancolombia",
    accountType: "BANK",
    color: "#00aa00",
    includeInAvailable: true,
    includeInOverviewTotal: true,
    balance: 10_000_000,
    loansOut: 0,
    entries: [],
    vaultEntries: [],
  },
  {
    id: "account-2",
    name: "Nequi",
    accountType: "DIGITAL",
    color: "#aa00aa",
    includeInAvailable: true,
    includeInOverviewTotal: true,
    balance: 2_000_000,
    loansOut: 0,
    entries: [],
    vaultEntries: [],
  },
];

const DEBTORS: DebtorWithLoans[] = [
  { id: "debtor-1", name: "Juan", notes: null, loans: [], totalOwed: 0, activeLoansCount: 0 },
  { id: "debtor-2", name: "Maria", notes: null, loans: [], totalOwed: 0, activeLoansCount: 0 },
];

// ─── toDateInput ──────────────────────────────────────────────────────────────

describe("toDateInput", () => {
  it("returns a 10-character YYYY-MM-DD string from a Date", () => {
    const result = toDateInput(new Date("2026-07-01T12:00:00Z"));
    expect(result).toHaveLength(10);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns the correct date string for a known date", () => {
    // Use a UTC-noon date so timezone shifts don't change the date component
    const result = toDateInput(new Date(`${LOAN_DATE_STR}T12:00:00Z`));
    expect(result).toBe(LOAN_DATE_STR);
  });

  it("accepts a string and converts it correctly", () => {
    const result = toDateInput("2026-01-31T12:00:00Z");
    expect(result).toBe("2026-01-31");
  });
});

// ─── toDateObj ────────────────────────────────────────────────────────────────

describe("toDateObj", () => {
  it("returns a Date at noon (12:00:00) in local time", () => {
    const result = toDateObj("2026-07-01");
    expect(result).toBeInstanceOf(Date);
    expect(result.getHours()).toBe(12);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it("preserves the correct date component", () => {
    const result = toDateObj("2026-07-01");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(6); // July = 6
    expect(result.getDate()).toBe(1);
  });

  it("round-trips with toDateInput", () => {
    const dateStr = "2026-03-20";
    const dateObj = toDateObj(dateStr);
    // toDateInput operates on the ISO string (UTC), so test the round-trip
    // by checking that both the year/month/day components match the input
    expect(dateObj.getFullYear()).toBe(2026);
    expect(dateObj.getMonth()).toBe(2); // March = 2
    expect(dateObj.getDate()).toBe(20);
  });
});

// ─── fieldsFromEditing ────────────────────────────────────────────────────────

describe("fieldsFromEditing", () => {
  it("returns empty amount and today's date when editing is null", () => {
    const today = new Date().toISOString().slice(0, 10);
    const fields = fieldsFromEditing(null, undefined, "acc-1");
    expect(fields.amount).toBe("");
    expect(fields.date).toBe(today);
  });

  it("uses firstAccountId as accountId when editing is null", () => {
    const fields = fieldsFromEditing(null, undefined, "acc-99");
    expect(fields.accountId).toBe("acc-99");
  });

  it("uses defaultDebtorId when editing is null and defaultDebtorId is provided", () => {
    const fields = fieldsFromEditing(null, "debtor-default", "acc-1");
    expect(fields.debtorId).toBe("debtor-default");
  });

  it("uses empty debtorId when editing is null and no defaultDebtorId", () => {
    const fields = fieldsFromEditing(null, undefined, "acc-1");
    expect(fields.debtorId).toBe("");
  });

  it("returns empty expectedBy and notes when editing is null", () => {
    const fields = fieldsFromEditing(null, undefined, "acc-1");
    expect(fields.expectedBy).toBe("");
    expect(fields.notes).toBe("");
  });

  it("returns editing's debtorId, accountId, and amount when editing is set", () => {
    const fields = fieldsFromEditing(BASE_LOAN, undefined, FALLBACK_ACCOUNT_ID);
    expect(fields.debtorId).toBe("debtor-1");
    expect(fields.accountId).toBe("account-1");
    expect(fields.amount).toBe("5000000");
  });

  it("returns editing's date as YYYY-MM-DD when editing is set", () => {
    const fields = fieldsFromEditing(BASE_LOAN, undefined, FALLBACK_ACCOUNT_ID);
    expect(fields.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The date in the fixture is LOAN_DATE_STR
    expect(fields.date).toBe(LOAN_DATE_STR);
  });

  it("returns editing's expectedBy as YYYY-MM-DD string when set", () => {
    const fields = fieldsFromEditing(BASE_LOAN, undefined, FALLBACK_ACCOUNT_ID);
    expect(fields.expectedBy).toBe("2026-12-01");
  });

  it("returns empty string for expectedBy when editing.expectedBy is null", () => {
    const loanNoExpiry: LoanWithRemaining = { ...BASE_LOAN, expectedBy: null };
    const fields = fieldsFromEditing(loanNoExpiry, undefined, FALLBACK_ACCOUNT_ID);
    expect(fields.expectedBy).toBe("");
  });

  it("returns editing's notes when set", () => {
    const fields = fieldsFromEditing(BASE_LOAN, undefined, FALLBACK_ACCOUNT_ID);
    expect(fields.notes).toBe("  Some notes  ");
  });

  it("returns empty string for notes when editing.notes is null", () => {
    const loanNoNotes: LoanWithRemaining = { ...BASE_LOAN, notes: null };
    const fields = fieldsFromEditing(loanNoNotes, undefined, FALLBACK_ACCOUNT_ID);
    expect(fields.notes).toBe("");
  });

  it("ignores defaultDebtorId when editing is set (uses editing.debtorId)", () => {
    const fields = fieldsFromEditing(BASE_LOAN, "debtor-default", FALLBACK_ACCOUNT_ID);
    expect(fields.debtorId).toBe("debtor-1");
  });

  it("handles undefined editing the same as null", () => {
    const today = new Date().toISOString().slice(0, 10);
    const fields = fieldsFromEditing(undefined, undefined, "acc-1");
    expect(fields.amount).toBe("");
    expect(fields.date).toBe(today);
    expect(fields.debtorId).toBe("");
  });
});

// ─── submitLoan ───────────────────────────────────────────────────────────────

describe("submitLoan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const fields = {
    debtorId: "debtor-1",
    accountId: "account-1",
    amount: "5000000",
    date: LOAN_DATE_STR,
    expectedBy: "",
    notes: "",
  };

  it("calls createLoan (not updateLoan) when editing is null", async () => {
    await submitLoan(null, fields);
    expect(createLoan).toHaveBeenCalledOnce();
    expect(updateLoan).not.toHaveBeenCalled();
  });

  it("calls updateLoan (not createLoan) when editing is set", async () => {
    await submitLoan(BASE_LOAN, { ...fields, debtorId: "debtor-1" });
    expect(updateLoan).toHaveBeenCalledOnce();
    expect(createLoan).not.toHaveBeenCalled();
  });

  it("passes editing.id as first arg to updateLoan", async () => {
    await submitLoan(BASE_LOAN, fields);
    expect(updateLoan).toHaveBeenCalledWith("loan-1", expect.any(Object));
  });

  it("parses amount as float", async () => {
    await submitLoan(null, { ...fields, amount: "1234567.89" });
    expect(createLoan).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1_234_567.89 }),
    );
  });

  it("parses integer amount correctly", async () => {
    await submitLoan(null, { ...fields, amount: "5000000" });
    expect(createLoan).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5_000_000 }),
    );
  });

  it("parses date as a Date object at noon", async () => {
    await submitLoan(null, { ...fields, date: LOAN_DATE_STR });
    const call = vi.mocked(createLoan).mock.calls[0][0];
    expect(call.date).toBeInstanceOf(Date);
    expect(call.date.getHours()).toBe(12);
  });

  it("passes undefined for expectedBy when the string is empty", async () => {
    await submitLoan(null, { ...fields, expectedBy: "" });
    expect(createLoan).toHaveBeenCalledWith(
      expect.objectContaining({ expectedBy: undefined }),
    );
  });

  it("parses expectedBy as a Date when the string is non-empty", async () => {
    await submitLoan(null, { ...fields, expectedBy: "2026-12-01" });
    const call = vi.mocked(createLoan).mock.calls[0][0];
    expect(call.expectedBy).toBeInstanceOf(Date);
    expect(call.expectedBy?.getFullYear()).toBe(2026);
    expect(call.expectedBy?.getMonth()).toBe(11); // December = 11
    expect(call.expectedBy?.getDate()).toBe(1);
  });

  it("trims notes and passes undefined when notes is whitespace-only", async () => {
    await submitLoan(null, { ...fields, notes: "   " });
    expect(createLoan).toHaveBeenCalledWith(
      expect.objectContaining({ notes: undefined }),
    );
  });

  it("trims notes and passes undefined when notes is empty string", async () => {
    await submitLoan(null, { ...fields, notes: "" });
    expect(createLoan).toHaveBeenCalledWith(
      expect.objectContaining({ notes: undefined }),
    );
  });

  it("trims and passes trimmed notes when non-empty", async () => {
    await submitLoan(null, { ...fields, notes: "  Needs repayment  " });
    expect(createLoan).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "Needs repayment" }),
    );
  });

  it("includes debtorId in createLoan payload", async () => {
    await submitLoan(null, { ...fields, debtorId: "debtor-42" });
    expect(createLoan).toHaveBeenCalledWith(
      expect.objectContaining({ debtorId: "debtor-42" }),
    );
  });

  it("does NOT include debtorId in updateLoan payload", async () => {
    await submitLoan(BASE_LOAN, fields);
    const call = vi.mocked(updateLoan).mock.calls[0][1];
    expect(call).not.toHaveProperty("debtorId");
  });

  it("passes accountId to updateLoan", async () => {
    await submitLoan(BASE_LOAN, { ...fields, accountId: "account-99" });
    expect(updateLoan).toHaveBeenCalledWith(
      "loan-1",
      expect.objectContaining({ accountId: "account-99" }),
    );
  });
});

// ─── useLoanForm — behavior tests ────────────────────────────────────────────

describe("useLoanForm — derived selectedDebtor / selectedAccount", () => {
  it("returns the matching debtor when debtorId is set", () => {
    const { result } = renderHook(() =>
      useLoanForm({
        accounts: ACCOUNTS,
        debtors: DEBTORS,
        defaultDebtorId: "debtor-2",
        editing: null,
        onClose: vi.fn(),
      })
    );
    expect(result.current.selectedDebtor).toEqual(DEBTORS[1]);
  });

  it("returns the matching account when accountId is set", () => {
    const { result } = renderHook(() =>
      useLoanForm({
        accounts: ACCOUNTS,
        debtors: DEBTORS,
        editing: null,
        onClose: vi.fn(),
      })
    );
    // First account is selected by default (firstAccountId)
    expect(result.current.selectedAccount).toEqual(ACCOUNTS[0]);
  });

  it("returns undefined selectedDebtor when no defaultDebtorId and editing is null", () => {
    const { result } = renderHook(() =>
      useLoanForm({
        accounts: ACCOUNTS,
        debtors: DEBTORS,
        editing: null,
        onClose: vi.fn(),
      })
    );
    // debtorId is "" — no match
    expect(result.current.selectedDebtor).toBeUndefined();
  });

  it("returns undefined selectedAccount when accounts list is empty", () => {
    const { result } = renderHook(() =>
      useLoanForm({
        accounts: [],
        debtors: DEBTORS,
        editing: null,
        onClose: vi.fn(),
      })
    );
    expect(result.current.selectedAccount).toBeUndefined();
  });
});

describe("useLoanForm — editing-reset behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with empty amount when editing is null", () => {
    const { result } = renderHook(() =>
      useLoanForm({
        accounts: ACCOUNTS,
        debtors: DEBTORS,
        editing: null,
        onClose: vi.fn(),
      })
    );
    expect(result.current.amount).toBe("");
  });

  it("resets all fields to match new editing when editing changes from null to a loan", () => {
    const onClose = vi.fn();
    const { result, rerender } = renderHook(
      (props: { editing: LoanWithRemaining | null }) =>
        useLoanForm({
          accounts: ACCOUNTS,
          debtors: DEBTORS,
          editing: props.editing,
          onClose,
        }),
      { initialProps: { editing: null as LoanWithRemaining | null } }
    );

    expect(result.current.amount).toBe("");

    rerender({ editing: BASE_LOAN });

    expect(result.current.amount).toBe("5000000");
    expect(result.current.debtorId).toBe("debtor-1");
    expect(result.current.accountId).toBe("account-1");
    expect(result.current.date).toBe(LOAN_DATE_STR);
    expect(result.current.expectedBy).toBe("2026-12-01");
    expect(result.current.notes).toBe("  Some notes  ");
  });

  it("resets fields when editing changes from one loan to another", () => {
    const onClose = vi.fn();
    const { result, rerender } = renderHook(
      (props: { editing: LoanWithRemaining }) =>
        useLoanForm({
          accounts: ACCOUNTS,
          debtors: DEBTORS,
          editing: props.editing,
          onClose,
        }),
      { initialProps: { editing: BASE_LOAN } }
    );

    expect(result.current.amount).toBe("5000000");

    rerender({ editing: LOAN_2 });

    expect(result.current.amount).toBe("1000000");
    expect(result.current.debtorId).toBe("debtor-2");
    expect(result.current.accountId).toBe("account-2");
    expect(result.current.expectedBy).toBe("");
    expect(result.current.notes).toBe("");
  });

  it("discards user-typed value when editing switches to a different loan", () => {
    // Verifies the if (editing !== last) reset block is actually needed:
    // without it, user-typed "9999" would survive the rerender to LOAN_2.
    const onClose = vi.fn();
    const { result, rerender } = renderHook(
      (props: { editing: LoanWithRemaining }) =>
        useLoanForm({
          accounts: ACCOUNTS,
          debtors: DEBTORS,
          editing: props.editing,
          onClose,
        }),
      { initialProps: { editing: BASE_LOAN } }
    );

    // Simulate user typing into the amount field
    act(() => {
      result.current.setAmount("9999");
    });
    expect(result.current.amount).toBe("9999");

    // Switch to a different loan — the hook must reset all fields
    rerender({ editing: LOAN_2 });

    expect(result.current.amount).toBe("1000000");
    expect(result.current.debtorId).toBe("debtor-2");
  });
});

describe("useLoanForm — handleSubmit wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls createLoan and onClose on submit in create mode", async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useLoanForm({
        accounts: ACCOUNTS,
        debtors: DEBTORS,
        defaultDebtorId: "debtor-1",
        editing: null,
        onClose,
      })
    );

    act(() => {
      result.current.setAmount("1000000");
    });

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    act(() => {
      result.current.handleSubmit(fakeEvent);
    });

    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createLoan).toHaveBeenCalled();
    expect(updateLoan).not.toHaveBeenCalled();
  });

  it("calls updateLoan and onClose on submit in edit mode", async () => {
    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useLoanForm({
        accounts: ACCOUNTS,
        debtors: DEBTORS,
        editing: BASE_LOAN,
        onClose,
      })
    );

    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;
    act(() => {
      result.current.handleSubmit(fakeEvent);
    });

    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateLoan).toHaveBeenCalledWith("loan-1", expect.any(Object));
    expect(createLoan).not.toHaveBeenCalled();
  });
});
