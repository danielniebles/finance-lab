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
