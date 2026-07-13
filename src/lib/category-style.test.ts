// Unit tests for the Category icon & color picker's resolver
// (resolveEffectiveCategoryStyle) — the piece that merges a category's
// stored icon/color override with the existing name-derived fallback,
// independently per field.

import { describe, it, expect } from "vitest";
import { Gift, ShoppingCart, Tag } from "lucide-react";
import {
  getCategoryStyle,
  resolveEffectiveCategoryStyle,
  getAutoCategoryKeys,
  categoryPaletteClasses,
  categoryIconDisplayName,
  categoryColorDisplayName,
  ICON_REGISTRY,
  CATEGORY_ICON_KEYS,
} from "./category-style";

describe("resolveEffectiveCategoryStyle", () => {
  it("falls back to the name-derived style when both fields are null (Auto/Auto)", () => {
    const auto = getCategoryStyle("Mercado");
    const resolved = resolveEffectiveCategoryStyle("Mercado", null, null);

    expect(resolved.icon).toBe(auto.icon);
    expect(resolved.badge).toBe(auto.badge);
    expect(resolved.iconWrap).toBe(auto.iconWrap);
    expect(resolved.icon).toBe(ShoppingCart);
  });

  it("a custom icon wins over the derived icon while color stays auto", () => {
    const auto = getCategoryStyle("Mercado"); // ShoppingCart / emerald
    const resolved = resolveEffectiveCategoryStyle("Mercado", "gift", null);

    expect(resolved.icon).toBe(Gift);
    expect(resolved.icon).not.toBe(auto.icon);
    // Color half is untouched — still the auto-derived emerald classes.
    expect(resolved.badge).toBe(auto.badge);
    expect(resolved.iconWrap).toBe(auto.iconWrap);
  });

  it("a custom color wins over the derived color while icon stays auto", () => {
    const auto = getCategoryStyle("Mercado"); // ShoppingCart / emerald
    const resolved = resolveEffectiveCategoryStyle("Mercado", null, "rose");

    expect(resolved.icon).toBe(auto.icon);
    expect(resolved.badge).toContain("rose");
    expect(resolved.iconWrap).toContain("rose");
    expect(resolved.badge).not.toBe(auto.badge);
  });

  it("both fields customized override the derived style entirely", () => {
    const resolved = resolveEffectiveCategoryStyle("Mercado", "gift", "rose");

    expect(resolved.icon).toBe(Gift);
    expect(resolved.badge).toContain("rose");
    expect(resolved.iconWrap).toContain("rose");
  });

  it("an unknown category name still resolves independently via the hash fallback (Tag icon, deterministic color)", () => {
    const auto = getCategoryStyle("Some Unmapped Category");
    expect(auto.icon).toBe(Tag);

    const resolved = resolveEffectiveCategoryStyle("Some Unmapped Category", "gift", null);
    expect(resolved.icon).toBe(Gift);
    expect(resolved.badge).toBe(auto.badge);
  });
});

describe("getAutoCategoryKeys", () => {
  it("returns the registry key for a name-derived icon that is one of the 16 selectable icons", () => {
    const { iconKey, colorKey } = getAutoCategoryKeys("Mercado");
    expect(iconKey).toBe("shopping-cart");
    expect(colorKey).toBe("emerald");
  });

  it("returns a null iconKey for names that fall back to the reserved Tag icon", () => {
    const { iconKey, colorKey } = getAutoCategoryKeys("Some Unmapped Category");
    expect(iconKey).toBeNull();
    expect(colorKey).not.toBeNull();
  });
});

describe("categoryPaletteClasses / display name helpers", () => {
  it("returns the exact PALETTE classes for a given color key", () => {
    const classes = categoryPaletteClasses("emerald");
    expect(classes.badge).toContain("emerald");
    expect(classes.iconWrap).toContain("emerald");
  });

  it("formats icon and color keys as natural-reading display names", () => {
    expect(categoryIconDisplayName("shopping-cart")).toBe("Shopping cart");
    expect(categoryIconDisplayName("paw-print")).toBe("Paw print");
    expect(categoryColorDisplayName("emerald")).toBe("Emerald");
  });

  it("ICON_REGISTRY does not expose the reserved Tag fallback as a selectable key", () => {
    expect(Object.values(ICON_REGISTRY)).not.toContain(Tag);
    expect(Object.keys(ICON_REGISTRY)).toHaveLength(CATEGORY_ICON_KEYS.length);
  });
});
