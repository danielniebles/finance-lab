// Component test for Settings → Categories' icon/color picker
// (CategorySwatchButton + CategoryStyleDialog). Mirrors transaction-row.test.tsx's
// Dialog-testing patterns (within(dialog), userEvent) since that's the most
// recent precedent for this exact Dialog-based edit surface in this codebase.
// Covers: opening the dialog from the row swatch, the Auto/Custom per-field
// state chip + reset flow (independent for icon vs. color), and Save/Cancel
// payloads.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryList } from "./category-list";

const createAppCategoryMock = vi.fn();
const updateAppCategoryMock = vi.fn();
const updateAppCategoryStyleMock = vi.fn();
const deleteAppCategoryMock = vi.fn();
const createBudgetItemMock = vi.fn();
const updateBudgetItemMock = vi.fn();
const deleteBudgetItemMock = vi.fn();

vi.mock("@/lib/actions/categories", () => ({
  createAppCategory: (...args: unknown[]) => createAppCategoryMock(...args),
  updateAppCategory: (...args: unknown[]) => updateAppCategoryMock(...args),
  updateAppCategoryStyle: (...args: unknown[]) => updateAppCategoryStyleMock(...args),
  deleteAppCategory: (...args: unknown[]) => deleteAppCategoryMock(...args),
  createBudgetItem: (...args: unknown[]) => createBudgetItemMock(...args),
  updateBudgetItem: (...args: unknown[]) => updateBudgetItemMock(...args),
  deleteBudgetItem: (...args: unknown[]) => deleteBudgetItemMock(...args),
}));

type Category = React.ComponentProps<typeof CategoryList>["categories"][number];

const CATEGORY_NAME = "Mercado";
const SWATCH_LABEL = `Customize icon and color for ${CATEGORY_NAME}`;
const SHOPPING_CART_ICON = "Shopping cart icon";
const GIFT_ICON = "Gift icon";
const EMERALD_COLOR = "Emerald color";
const ROSE_COLOR = "Rose color";
const RESET_TO_AUTO = "Reset to auto";
const ARIA_PRESSED = "aria-pressed";

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    name: CATEGORY_NAME,
    icon: null,
    color: null,
    budgetItems: [],
    _count: { mappings: 1 },
    ...overrides,
  };
}

// Renders the list, opens the style dialog for the single fixture category,
// and returns the dialog element scoped with `within`.
async function renderAndOpenDialog(user: ReturnType<typeof userEvent.setup>) {
  render(<CategoryList categories={[makeCategory()]} />);
  await user.click(screen.getByRole("button", { name: SWATCH_LABEL }));
  return within(screen.getByRole("dialog"));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CategorySwatchButton", () => {
  it("has an accessible name naming the category and opens the style dialog on click", async () => {
    const user = userEvent.setup();
    const dialog = await renderAndOpenDialog(user);

    expect(dialog.getByText("Customize icon & color")).toBeInTheDocument();
    expect(dialog.getByText(CATEGORY_NAME, { selector: "p" })).toBeInTheDocument();
  });
});

describe("CategoryStyleDialog — Auto/Custom state", () => {
  it("shows both fields as Auto with the name-derived icon/color highlighted, no reset buttons", async () => {
    const user = userEvent.setup();
    const dialog = await renderAndOpenDialog(user);

    expect(dialog.getAllByText("Auto")).toHaveLength(2);
    expect(dialog.queryByRole("button", { name: RESET_TO_AUTO })).not.toBeInTheDocument();

    // "Mercado" derives to the shopping-cart icon / emerald color rule.
    expect(dialog.getByRole("button", { name: SHOPPING_CART_ICON })).toHaveAttribute(ARIA_PRESSED, "true");
    expect(dialog.getByRole("button", { name: EMERALD_COLOR })).toHaveAttribute(ARIA_PRESSED, "true");
  });

  it("picking a custom icon flips only the Icon field to Custom, independent of Color", async () => {
    const user = userEvent.setup();
    const dialog = await renderAndOpenDialog(user);

    await user.click(dialog.getByRole("button", { name: GIFT_ICON }));

    expect(dialog.getByText("Custom")).toBeInTheDocument();
    expect(dialog.getByText("Auto")).toBeInTheDocument(); // Color section still Auto
    expect(dialog.getByRole("button", { name: RESET_TO_AUTO })).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: GIFT_ICON })).toHaveAttribute(ARIA_PRESSED, "true");
    expect(dialog.getByRole("button", { name: SHOPPING_CART_ICON })).toHaveAttribute(ARIA_PRESSED, "false");
  });

  it("Reset to auto clears the custom icon back to Auto", async () => {
    const user = userEvent.setup();
    const dialog = await renderAndOpenDialog(user);

    await user.click(dialog.getByRole("button", { name: GIFT_ICON }));
    await user.click(dialog.getByRole("button", { name: RESET_TO_AUTO }));

    expect(dialog.queryByRole("button", { name: RESET_TO_AUTO })).not.toBeInTheDocument();
    expect(dialog.getAllByText("Auto")).toHaveLength(2);
    expect(dialog.getByRole("button", { name: SHOPPING_CART_ICON })).toHaveAttribute(ARIA_PRESSED, "true");
  });
});

describe("CategoryStyleDialog — Save / Cancel", () => {
  it("Save calls updateAppCategoryStyle with the current draft icon/color and closes the dialog", async () => {
    const user = userEvent.setup();
    const dialog = await renderAndOpenDialog(user);

    await user.click(dialog.getByRole("button", { name: GIFT_ICON }));
    await user.click(dialog.getByRole("button", { name: ROSE_COLOR }));
    await user.click(dialog.getByRole("button", { name: "Save changes" }));

    expect(updateAppCategoryStyleMock).toHaveBeenCalledWith("cat-1", { icon: "gift", color: "rose" });
  });

  it("Cancel discards the draft without calling updateAppCategoryStyle", async () => {
    const user = userEvent.setup();
    const dialog = await renderAndOpenDialog(user);

    await user.click(dialog.getByRole("button", { name: GIFT_ICON }));
    await user.click(dialog.getByRole("button", { name: "Cancel" }));

    expect(updateAppCategoryStyleMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Reopening shows the draft reset back to the category's persisted (Auto) style.
    await user.click(screen.getByRole("button", { name: SWATCH_LABEL }));
    expect(screen.getByRole("button", { name: SHOPPING_CART_ICON })).toHaveAttribute(ARIA_PRESSED, "true");
  });
});

describe("CategoryDialog — delete", () => {
  it("shows why a category in use can't be deleted, and keeps the dialog open", async () => {
    deleteAppCategoryMock.mockResolvedValueOnce({ error: "3 transactions still use it. Move them to another category first." });
    const user = userEvent.setup();
    render(<CategoryList categories={[makeCategory()]} />);

    await user.click(screen.getByRole("button", { name: new RegExp(`^${CATEGORY_NAME}`) }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete category" }));

    expect(deleteAppCategoryMock).toHaveBeenCalledWith("cat-1");
    expect(await screen.findByText(/3 transactions still use it/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("BudgetItemDialog", () => {
  it("ticks Monthly bill for fixed items until the user decides", async () => {
    const user = userEvent.setup();
    render(<CategoryList categories={[makeCategory()]} />);

    await user.click(screen.getByRole("button", { name: `Show budget items for ${CATEGORY_NAME}` }));
    await user.click(screen.getByRole("button", { name: "Add item" }));
    const dialog = within(screen.getByRole("dialog"));
    const bill = dialog.getByRole("checkbox", { name: /Monthly bill/ });
    expect(bill).toBeChecked();
    await user.click(dialog.getByRole("radio", { name: "Variable" }));
    expect(bill).not.toBeChecked();
    // Electricity: variable, but a bill.
    await user.click(bill);
    await user.click(dialog.getByRole("radio", { name: "Fixed" }));
    await user.click(dialog.getByRole("radio", { name: "Variable" }));
    expect(bill).toBeChecked();
    await user.type(dialog.getByLabelText("Name"), "Electricity");
    await user.type(dialog.getByLabelText("Per month"), "140000");
    await user.click(dialog.getByRole("button", { name: "Add item" }));

    expect(createBudgetItemMock).toHaveBeenCalledWith("cat-1", { name: "Electricity", amount: 140000, budgetType: "VARIABLE", isBill: true });
  });

  it("adds a budget item with a typed amount and type", async () => {
    const user = userEvent.setup();
    render(<CategoryList categories={[makeCategory()]} />);

    await user.click(screen.getByRole("button", { name: `Show budget items for ${CATEGORY_NAME}` }));
    await user.click(screen.getByRole("button", { name: "Add item" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText("Name"), "Weekly market");
    await user.type(dialog.getByLabelText("Per month"), "800000");
    await user.click(dialog.getByRole("radio", { name: "Variable" }));
    await user.click(dialog.getByRole("button", { name: "Add item" }));

    expect(createBudgetItemMock).toHaveBeenCalledWith("cat-1", { name: "Weekly market", amount: 800000, budgetType: "VARIABLE", isBill: false });
  });

  it("editing loads the item and saving keeps unchanged fields", async () => {
    const user = userEvent.setup();
    render(
      <CategoryList
        categories={[makeCategory({ budgetItems: [{ id: "bi-1", name: "Rent", amount: 1500000, budgetType: "FIXED", isBill: true }] })]}
      />,
    );

    await user.click(screen.getByRole("button", { name: `Show budget items for ${CATEGORY_NAME}` }));
    await user.click(screen.getByRole("button", { name: /Rent/ }));
    expect(screen.getByDisplayValue("1.500.000")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(updateBudgetItemMock).toHaveBeenCalledWith("bi-1", { name: "Rent", amount: 1500000, budgetType: "FIXED", isBill: true });
  });
});
