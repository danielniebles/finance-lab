// Component test for the counterparty-rules settings page list/form.
// Covers: rendering the list with rules, creating a new rule (asserts the
// server action is called with the right shape), editing a rule via the
// tap-to-open dialog, and deleting a rule via the dialog's confirm-delete
// step (no more hover-reveal icons or window.confirm — mirrors
// category-list.tsx's CategoryEditDialog / tag-list.tsx's TagEditDialog).

import { describe, it, expect, vi, beforeEach } from "vitest";
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

const WALLET_OPTIONS = [
  { id: "wallet-investments", name: "Investments" },
  { id: "wallet-cash", name: "Cash" },
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
    walletId: "wallet-investments",
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

beforeEach(() => {
  vi.resetAllMocks();
});

describe("RuleList — rendering", () => {
  it("renders a rule row with its category, wallet, and match info", () => {
    render(<RuleList rules={[makeRule()]} categories={CATEGORIES} walletOptions={WALLET_OPTIONS} />);

    expect(screen.getByText("61793614704")).toBeInTheDocument();
    expect(screen.getByText("Pets")).toBeInTheDocument();
    expect(screen.getByText("· Investments")).toBeInTheDocument();
    expect(screen.getByText("Auto-record")).toBeInTheDocument();
    expect(screen.getByText("3 matches")).toBeInTheDocument();
  });

  it("shows 'Never' when lastMatchedAt is null", () => {
    render(
      <RuleList
        rules={[makeRule({ lastMatchedAt: null, matchCount: 0 })]}
        categories={CATEGORIES}
        walletOptions={WALLET_OPTIONS}
      />
    );

    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getByText("0 matches")).toBeInTheDocument();
  });

  it("shows an empty state when there are no rules", () => {
    render(<RuleList rules={[]} categories={CATEGORIES} walletOptions={WALLET_OPTIONS} />);

    expect(screen.getByText("No rules yet. Add one below.")).toBeInTheDocument();
  });

  it("does not render hover-reveal edit/delete icon buttons on the row", () => {
    render(<RuleList rules={[makeRule()]} categories={CATEGORIES} walletOptions={WALLET_OPTIONS} />);

    // The whole row is the "Edit rule" affordance itself — there must be no
    // separate "Delete rule" icon button sitting outside the dialog anymore.
    expect(screen.queryByRole("button", { name: "Delete rule" })).not.toBeInTheDocument();
  });
});

describe("RuleList — create", () => {
  // Explicit timeout: this test now drives two Select popovers (category +
  // wallet) plus typing and submit — under full-suite parallel contention
  // that exceeds Vitest's 5000ms default, even though each interaction is
  // fast in isolation (see the standalone run, ~2.4s for the whole file).
  it(
    "creating a rule calls createCounterpartyRule with the form shape",
    async () => {
      const user = userEvent.setup();
      render(<RuleList rules={[]} categories={CATEGORIES} walletOptions={WALLET_OPTIONS} />);

      await user.click(screen.getByRole("button", { name: /add rule/i }));

      await user.type(screen.getByPlaceholderText("Account number"), "123456");

      await user.click(screen.getByText("Select…"));
      await user.click(await screen.findByRole("option", { name: "Pets" }));

      await user.click(screen.getByRole("combobox", { name: "Wallet" }));
      await user.click(await screen.findByRole("option", { name: "Investments" }));

      await user.click(screen.getByRole("button", { name: "Create rule" }));

      expect(createCounterpartyRuleMock).toHaveBeenCalledWith(
        expect.objectContaining({
          matchType: "ACCOUNT",
          matchValue: "123456",
          appCategoryId: "cat-pets",
          wallet: "Investments",
          walletId: "wallet-investments",
          autoRecord: true,
          recurring: false,
        })
      );
    },
    10000
  );

  it("shows a visible hint (not just a disabled button) while no wallet is selected", async () => {
    const user = userEvent.setup();
    render(<RuleList rules={[]} categories={CATEGORIES} walletOptions={WALLET_OPTIONS} />);

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    expect(screen.getByText("Select a wallet to save")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create rule" })).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Wallet" }));
    await user.click(await screen.findByRole("option", { name: "Investments" }));

    expect(screen.queryByText("Select a wallet to save")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create rule" })).not.toBeDisabled();
  });

  it("recurring gates the expectedAmount field's visibility", async () => {
    const user = userEvent.setup();
    render(<RuleList rules={[]} categories={CATEGORIES} walletOptions={WALLET_OPTIONS} />);

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    expect(screen.queryByPlaceholderText("Expected amount")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Recurring"));

    expect(screen.getByPlaceholderText("Expected amount")).toBeInTheDocument();
  });
});

describe("RuleList — edit", () => {
  it("tapping the row opens an edit dialog pre-filled with the rule's values", async () => {
    const user = userEvent.setup();
    render(<RuleList rules={[makeRule()]} categories={CATEGORIES} walletOptions={WALLET_OPTIONS} />);

    await user.click(screen.getByRole("button", { name: "Edit rule" }));

    expect(screen.getByRole("dialog", { name: "Edit rule" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("61793614704")).toBeInTheDocument();
  });

  it("editing a rule calls updateCounterpartyRule with the updated shape", async () => {
    const user = userEvent.setup();
    render(<RuleList rules={[makeRule()]} categories={CATEGORIES} walletOptions={WALLET_OPTIONS} />);

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
        walletOptions={WALLET_OPTIONS}
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
  it("delete requires a confirm step inside the dialog before calling deleteCounterpartyRule", async () => {
    const user = userEvent.setup();
    render(<RuleList rules={[makeRule()]} categories={CATEGORIES} walletOptions={WALLET_OPTIONS} />);

    await user.click(screen.getByRole("button", { name: "Edit rule" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    // Confirm step shown, nothing deleted yet.
    expect(screen.getByText(/Delete this rule for/)).toBeInTheDocument();
    expect(deleteCounterpartyRuleMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirm delete" }));

    expect(deleteCounterpartyRuleMock).toHaveBeenCalledWith("rule-1");
  });

  it("cancelling the confirm step does not delete", async () => {
    const user = userEvent.setup();
    render(<RuleList rules={[makeRule()]} categories={CATEGORIES} walletOptions={WALLET_OPTIONS} />);

    await user.click(screen.getByRole("button", { name: "Edit rule" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteCounterpartyRuleMock).not.toHaveBeenCalled();
    // Back to the edit form.
    expect(screen.getByDisplayValue("61793614704")).toBeInTheDocument();
  });
});
