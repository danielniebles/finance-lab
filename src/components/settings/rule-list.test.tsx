// Component test for the Phase 2 counterparty-rules settings page list/form.
// Covers: rendering the list with rules, creating a new rule (asserts the
// server action is called with the right shape), editing a rule, deleting a
// rule, and the recurring-gates-expectedAmount conditional visibility.

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RuleList, type CounterpartyRuleRowData } from "./rule-list";

const createCounterpartyRuleMock = vi.fn();
const updateCounterpartyRuleMock = vi.fn();
const deleteCounterpartyRuleMock = vi.fn();

vi.mock("@/lib/actions/counterparty-rules", () => ({
  createCounterpartyRule: (...args: unknown[]) => createCounterpartyRuleMock(...args),
  updateCounterpartyRule: (...args: unknown[]) => updateCounterpartyRuleMock(...args),
  deleteCounterpartyRule: (...args: unknown[]) => deleteCounterpartyRuleMock(...args),
}));

const CATEGORIES = [
  { id: "cat-pets", name: "Pets" },
  { id: "cat-family", name: "Family" },
];

function makeRule(overrides: Partial<CounterpartyRuleRowData> = {}): CounterpartyRuleRowData {
  return {
    id: "rule-1",
    matchType: "ACCOUNT",
    matchValue: "61793614704",
    direction: "ANY",
    appCategoryId: "cat-pets",
    appCategoryName: "Pets",
    wallet: "Investments",
    autoRecord: true,
    recurring: false,
    expectedAmount: null,
    notes: null,
    matchCount: 3,
    lastMatchedAt: new Date("2026-06-01T12:00:00Z"),
    createdAt: new Date("2026-01-01T12:00:00Z"),
    ...overrides,
  };
}

const originalConfirm = window.confirm;

beforeEach(() => {
  vi.resetAllMocks();
  window.confirm = vi.fn(() => true);
});

afterAll(() => {
  window.confirm = originalConfirm;
});

describe("RuleList — rendering", () => {
  it("renders a rule row with its category, wallet, and match info", () => {
    render(<RuleList rules={[makeRule()]} categories={CATEGORIES} />);

    expect(screen.getByText("61793614704")).toBeInTheDocument();
    expect(screen.getByText("Pets")).toBeInTheDocument();
    expect(screen.getByText("· Investments")).toBeInTheDocument();
    expect(screen.getByText("Auto-record")).toBeInTheDocument();
    expect(screen.getByText("3 matches")).toBeInTheDocument();
  });

  it("shows 'Never' when lastMatchedAt is null", () => {
    render(<RuleList rules={[makeRule({ lastMatchedAt: null, matchCount: 0 })]} categories={CATEGORIES} />);

    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getByText("0 matches")).toBeInTheDocument();
  });

  it("shows an empty state when there are no rules", () => {
    render(<RuleList rules={[]} categories={CATEGORIES} />);

    expect(screen.getByText("No rules yet. Add one below.")).toBeInTheDocument();
  });
});

describe("RuleList — create", () => {
  it("creating a rule calls createCounterpartyRule with the form shape", async () => {
    const user = userEvent.setup();
    render(<RuleList rules={[]} categories={CATEGORIES} />);

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    await user.type(screen.getByPlaceholderText("Account number"), "123456");
    await user.type(screen.getByPlaceholderText("Wallet"), "Investments");

    await user.click(screen.getByText("Select…"));
    await user.click(await screen.findByRole("option", { name: "Pets" }));

    await user.click(screen.getByRole("button", { name: "Create rule" }));

    expect(createCounterpartyRuleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        matchType: "ACCOUNT",
        matchValue: "123456",
        appCategoryId: "cat-pets",
        wallet: "Investments",
        autoRecord: true,
        recurring: false,
      })
    );
  });

  it("recurring gates the expectedAmount field's visibility", async () => {
    const user = userEvent.setup();
    render(<RuleList rules={[]} categories={CATEGORIES} />);

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    expect(screen.queryByPlaceholderText("Expected amount")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Recurring"));

    expect(screen.getByPlaceholderText("Expected amount")).toBeInTheDocument();
  });
});

describe("RuleList — edit", () => {
  it("editing a rule calls updateCounterpartyRule with the updated shape", async () => {
    const user = userEvent.setup();
    render(<RuleList rules={[makeRule()]} categories={CATEGORIES} />);

    await user.click(screen.getByRole("button", { name: "Edit rule" }));

    const matchValueInput = screen.getByDisplayValue("61793614704");
    await user.clear(matchValueInput);
    await user.type(matchValueInput, "999999");

    await user.click(screen.getByRole("button", { name: "Save rule" }));

    expect(updateCounterpartyRuleMock).toHaveBeenCalledWith(
      "rule-1",
      expect.objectContaining({ matchValue: "999999" })
    );
  });

  it("does not submit a stale expectedAmount after recurring is unchecked", async () => {
    const user = userEvent.setup();
    render(
      <RuleList
        rules={[makeRule({ recurring: true, expectedAmount: 50000 })]}
        categories={CATEGORIES}
      />
    );

    await user.click(screen.getByRole("button", { name: "Edit rule" }));

    // Expected amount input is visible and pre-filled while recurring.
    expect(screen.getByDisplayValue("50000")).toBeInTheDocument();

    // Uncheck recurring — the input disappears but its stale value stays in
    // local state.
    await user.click(screen.getByLabelText("Recurring"));
    expect(screen.queryByPlaceholderText("Expected amount")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save rule" }));

    expect(updateCounterpartyRuleMock).toHaveBeenCalledWith(
      "rule-1",
      expect.objectContaining({ recurring: false, expectedAmount: undefined })
    );
  });
});

describe("RuleList — delete", () => {
  it("delete confirms then calls deleteCounterpartyRule", async () => {
    const user = userEvent.setup();
    render(<RuleList rules={[makeRule()]} categories={CATEGORIES} />);

    await user.click(screen.getByRole("button", { name: "Delete rule" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(deleteCounterpartyRuleMock).toHaveBeenCalledWith("rule-1");
  });
});
