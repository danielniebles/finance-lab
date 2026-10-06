// Component test for the counterparty-rules settings page list/form.
// Create and edit both use the same RuleDialog (FormDialog). jsdom applies
// no media queries, so both OptionSelect variants render; the tests drive
// the native <select> (the one phones get).
// Covers: rendering the list with rules, creating a new rule (asserts the
// server action is called with the right shape), editing a rule via the
// tap-to-open dialog, and deleting a rule via the dialog's confirm-delete
// step (no more hover-reveal icons or window.confirm — mirrors
// category-list.tsx's CategoryEditDialog / tag-list.tsx's TagEditDialog).

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

    expect(screen.getByText("No rules yet.")).toBeInTheDocument();
  });

  it("does not render hover-reveal edit/delete icon buttons on the row", () => {
    render(<RuleList rules={[makeRule()]} categories={CATEGORIES} walletOptions={WALLET_OPTIONS} />);

    // The whole row is the "Edit rule" affordance itself — there must be no
    // separate "Delete rule" icon button sitting outside the dialog anymore.
    expect(screen.queryByRole("button", { name: "Delete rule" })).not.toBeInTheDocument();
  });
});

function nativeSelect(label: string) {
  return screen.getByRole("dialog").querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
}

describe("RuleList — create", () => {
  it("creating a rule calls createCounterpartyRule with the form shape", async () => {
    const user = userEvent.setup();
    render(<RuleList rules={[]} categories={CATEGORIES} walletOptions={WALLET_OPTIONS} />);

    await user.click(screen.getByRole("button", { name: /add rule/i }));
    await user.type(screen.getByLabelText("Account number"), "123456");
    await user.selectOptions(nativeSelect("Category"), "Pets");
    await user.selectOptions(nativeSelect("Wallet"), "Investments");
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
  });

  it("says what's missing (not just a disabled button) until a wallet is picked", async () => {
    const user = userEvent.setup();
    render(<RuleList rules={[]} categories={CATEGORIES} walletOptions={WALLET_OPTIONS} />);

    await user.click(screen.getByRole("button", { name: /add rule/i }));
    await user.type(screen.getByLabelText("Account number"), "123456");
    await user.selectOptions(nativeSelect("Category"), "Pets");

    expect(screen.getByText("Pick a wallet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create rule" })).toBeDisabled();

    await user.selectOptions(nativeSelect("Wallet"), "Investments");

    expect(screen.queryByText("Pick a wallet.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create rule" })).not.toBeDisabled();
  });

  it("recurring gates the expectedAmount field's visibility", async () => {
    const user = userEvent.setup();
    render(<RuleList rules={[]} categories={CATEGORIES} walletOptions={WALLET_OPTIONS} />);

    await user.click(screen.getByRole("button", { name: /add rule/i }));

    expect(screen.queryByLabelText(/Expected amount/)).not.toBeInTheDocument();

    await user.click(screen.getByText("Recurring"));

    expect(screen.getByLabelText(/Expected amount/)).toBeInTheDocument();
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
    expect(screen.getByDisplayValue("50.000")).toBeInTheDocument();

    // Uncheck recurring — the input disappears but its stale value stays in
    // local state.
    await user.click(within(screen.getByRole("dialog")).getByText("Recurring"));
    expect(screen.queryByLabelText(/Expected amount/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save rule" }));

    expect(updateCounterpartyRuleMock).toHaveBeenCalledWith(
      "rule-1",
      // null clears the stored amount (undefined used to leave it in place).
      expect.objectContaining({ recurring: false, expectedAmount: null })
    );
  });

  it("emptying the notes clears them (null, not undefined)", async () => {
    const user = userEvent.setup();
    render(<RuleList rules={[makeRule({ notes: "Vet" })]} categories={CATEGORIES} walletOptions={WALLET_OPTIONS} />);

    await user.click(screen.getByRole("button", { name: "Edit rule" }));
    await user.clear(screen.getByDisplayValue("Vet"));
    await user.click(screen.getByRole("button", { name: "Save rule" }));

    expect(updateCounterpartyRuleMock).toHaveBeenCalledWith("rule-1", expect.objectContaining({ notes: null }));
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
