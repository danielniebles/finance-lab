import {
  ShoppingCart,
  UtensilsCrossed,
  Bus,
  Receipt,
  HeartPulse,
  Plane,
  ShoppingBag,
  Film,
  GraduationCap,
  Home,
  Smartphone,
  Dumbbell,
  Gift,
  PawPrint,
  Landmark,
  Wallet,
  Beef,
  Fish,
  Carrot,
  PaintbrushVertical,
  BriefcaseMedical,
  Drama,
  Gamepad2,
  HandHeart,
  Tag,
  type LucideIcon,
} from "lucide-react";
import {
  CATEGORY_ICON_KEYS,
  CATEGORY_COLOR_KEYS,
  type CategoryIconKey,
  type CategoryColorKey,
} from "@/lib/category-keys";

export type CategoryPalette = {
  icon: LucideIcon;
  badge: string;
  iconWrap: string;
};

// Re-exported so existing callers (the icon/color picker, Server Actions)
// keep importing the key lists/types from this module — the actual lists
// live in the zero-dependency src/lib/category-keys.ts, which is also
// imported directly by src/lib/actions/categories.ts, so both sides
// validate/render against the exact same source of truth.
export { CATEGORY_ICON_KEYS, CATEGORY_COLOR_KEYS };
export type { CategoryIconKey, CategoryColorKey };

// Complete literal class strings (not interpolated) so Tailwind's compiler can
// see and generate them — dynamic `bg-${color}-500` templates would not.
const PALETTE: Record<CategoryColorKey, { badge: string; iconWrap: string }> = {
  emerald: {
    badge: "border-emerald-500/25 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400",
    iconWrap: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  },
  orange: {
    badge: "border-orange-500/25 bg-orange-500/8 text-orange-600 dark:text-orange-400",
    iconWrap: "bg-orange-500/12 text-orange-600 dark:text-orange-400",
  },
  blue: {
    badge: "border-blue-500/25 bg-blue-500/8 text-blue-600 dark:text-blue-400",
    iconWrap: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  },
  violet: {
    badge: "border-violet-500/25 bg-violet-500/8 text-violet-600 dark:text-violet-400",
    iconWrap: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
  },
  rose: {
    badge: "border-rose-500/25 bg-rose-500/8 text-rose-600 dark:text-rose-400",
    iconWrap: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
  },
  cyan: {
    badge: "border-cyan-500/25 bg-cyan-500/8 text-cyan-600 dark:text-cyan-400",
    iconWrap: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-400",
  },
  pink: {
    badge: "border-pink-500/25 bg-pink-500/8 text-pink-600 dark:text-pink-400",
    iconWrap: "bg-pink-500/12 text-pink-600 dark:text-pink-400",
  },
  fuchsia: {
    badge: "border-fuchsia-500/25 bg-fuchsia-500/8 text-fuchsia-600 dark:text-fuchsia-400",
    iconWrap: "bg-fuchsia-500/12 text-fuchsia-600 dark:text-fuchsia-400",
  },
  amber: {
    badge: "border-amber-500/25 bg-amber-500/8 text-amber-600 dark:text-amber-400",
    iconWrap: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  },
  teal: {
    badge: "border-teal-500/25 bg-teal-500/8 text-teal-600 dark:text-teal-400",
    iconWrap: "bg-teal-500/12 text-teal-600 dark:text-teal-400",
  },
  indigo: {
    badge: "border-indigo-500/25 bg-indigo-500/8 text-indigo-600 dark:text-indigo-400",
    iconWrap: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400",
  },
} as const;

// Solid `-500` swatch classes for the icon/color picker's color grid, where
// the whole point is comparing the 11 options at full saturation (unlike
// `badge`/`iconWrap` above, which use tinted opacity for rendered content).
// Kept as complete literal strings for the same Tailwind-compiler reason as
// PALETTE.
export const CATEGORY_SOLID_SWATCH: Record<CategoryColorKey, string> = {
  emerald: "bg-emerald-500",
  orange: "bg-orange-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
  cyan: "bg-cyan-500",
  pink: "bg-pink-500",
  fuchsia: "bg-fuchsia-500",
  amber: "bg-amber-500",
  teal: "bg-teal-500",
  indigo: "bg-indigo-500",
};

// Stable registry of the 24 selectable icon keys (Category icon & color
// picker), keyed by the shared `CategoryIconKey` union imported from
// src/lib/category-keys.ts — that same module's `CATEGORY_ICON_KEYS` is also
// imported directly by src/lib/actions/categories.ts, so both sides
// render/validate against one source of truth. `Tag` is deliberately
// excluded: it stays reserved as the presentational null/unmatched-name
// fallback in `getCategoryStyle` below and is never a storable override.
export const ICON_REGISTRY: Record<CategoryIconKey, LucideIcon> = {
  "shopping-cart": ShoppingCart,
  "utensils-crossed": UtensilsCrossed,
  bus: Bus,
  receipt: Receipt,
  "heart-pulse": HeartPulse,
  plane: Plane,
  "shopping-bag": ShoppingBag,
  film: Film,
  "graduation-cap": GraduationCap,
  home: Home,
  smartphone: Smartphone,
  dumbbell: Dumbbell,
  gift: Gift,
  "paw-print": PawPrint,
  landmark: Landmark,
  wallet: Wallet,
  beef: Beef,
  fish: Fish,
  carrot: Carrot,
  "paintbrush-vertical": PaintbrushVertical,
  "briefcase-medical": BriefcaseMedical,
  drama: Drama,
  "gamepad-2": Gamepad2,
  "hand-heart": HandHeart,
};

// Display label for an icon/color picker swatch's aria-label, e.g.
// "shopping-cart" -> "Shopping cart", "paw-print" -> "Paw print". Only the
// first character is capitalized (not each word) to read as a natural
// phrase, per Design's spec examples ("Shopping cart icon").
export function categoryIconDisplayName(key: string): string {
  const spaced = key.split("-").join(" ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function categoryColorDisplayName(key: CategoryColorKey): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

const FALLBACK_ORDER: CategoryColorKey[] = [
  "blue", "violet", "orange", "teal", "pink", "amber", "cyan", "fuchsia", "indigo", "rose",
];

// Keyword → {icon, palette color}. Covers common MoneyLover/AppCategory names
// in both Spanish and English; matching is substring-based on the lowercased
// category name so "Mercado", "Supermercado", "Groceries" all hit the same rule.
const CATEGORY_RULES: { keywords: string[]; icon: LucideIcon; color: CategoryColorKey }[] = [
  { keywords: ["mercado", "supermercado", "grocer"], icon: ShoppingCart, color: "emerald" },
  { keywords: ["comida", "restaurant", "dining", "food", "cafe", "café"], icon: UtensilsCrossed, color: "orange" },
  { keywords: ["transporte", "transport", "uber", "taxi", "gas", "fuel", "gasolina"], icon: Bus, color: "blue" },
  { keywords: ["servicio", "bill", "factura", "utilit", "credit card", "tarjeta"], icon: Receipt, color: "violet" },
  { keywords: ["salud", "health", "medic", "doctor", "farmacia", "pharmacy"], icon: HeartPulse, color: "rose" },
  { keywords: ["viaje", "travel", "vuelo", "flight", "hotel"], icon: Plane, color: "cyan" },
  { keywords: ["compra", "shopping", "ropa", "cloth"], icon: ShoppingBag, color: "pink" },
  { keywords: ["entreten", "entertain", "cine", "movie", "streaming", "música", "music"], icon: Film, color: "fuchsia" },
  { keywords: ["educ", "curso", "course", "school", "colegio", "universidad"], icon: GraduationCap, color: "amber" },
  { keywords: ["hogar", "home", "rent", "arriendo", "alquiler"], icon: Home, color: "teal" },
  { keywords: ["telefon", "phone", "internet", "wifi"], icon: Smartphone, color: "indigo" },
  { keywords: ["gym", "gimnasio", "fitness", "deporte", "sport"], icon: Dumbbell, color: "orange" },
  { keywords: ["regalo", "gift"], icon: Gift, color: "pink" },
  { keywords: ["mascota", "pet"], icon: PawPrint, color: "amber" },
  { keywords: ["salario", "salary", "income", "ingreso", "nomina", "nómina"], icon: Landmark, color: "emerald" },
  { keywords: ["ahorro", "saving", "invest"], icon: Wallet, color: "teal" },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Shared name-matching algorithm: both `getCategoryStyle` and
// `getAutoCategoryKeys` need "does this (already lowercased/trimmed) name
// match a CATEGORY_RULES entry" — kept in one place so the substring-match
// behavior can't drift between the two call sites.
function findMatchingRule(name: string): (typeof CATEGORY_RULES)[number] | undefined {
  return CATEGORY_RULES.find((r) => r.keywords.some((k) => name.includes(k)));
}

// Deterministic fallback color for a name that matched no CATEGORY_RULES
// entry, shared by the same two callers as `findMatchingRule` above so the
// hash-to-color mapping stays a single algorithm.
function resolveFallbackColor(name: string): CategoryColorKey {
  return FALLBACK_ORDER[hashString(name) % FALLBACK_ORDER.length];
}

// Exposes a single PALETTE color's classes for callers that need to render a
// swatch/preview for a specific, already-known color key (the icon/color
// picker's color grid and its live preview) rather than deriving a style
// from a category name.
export function categoryPaletteClasses(key: CategoryColorKey): { badge: string; iconWrap: string } {
  return PALETTE[key];
}

function findIconKey(icon: LucideIcon): CategoryIconKey | null {
  return CATEGORY_ICON_KEYS.find((k) => ICON_REGISTRY[k] === icon) ?? null;
}

// For the icon/color picker: which grid button (if any) represents the
// "Auto" value for a given category name, so the UI can ring-highlight it
// when that field has no stored override yet. `iconKey` can be null (the
// name-derived icon is the reserved `Tag` fallback, which isn't one of the
// 24 selectable registry keys) — `colorKey` is always resolvable for any
// non-empty category name (rule match or deterministic hash fallback).
export function getAutoCategoryKeys(categoryName: string | null): {
  iconKey: CategoryIconKey | null;
  colorKey: CategoryColorKey | null;
} {
  const name = categoryName?.trim().toLowerCase() ?? "";

  if (name) {
    const rule = findMatchingRule(name);
    if (rule) {
      return { iconKey: findIconKey(rule.icon), colorKey: rule.color };
    }
  }

  if (!categoryName) {
    return { iconKey: null, colorKey: null };
  }

  return { iconKey: null, colorKey: resolveFallbackColor(name) };
}

export function getCategoryStyle(categoryName: string | null): CategoryPalette {
  const name = categoryName?.trim().toLowerCase() ?? "";

  if (name) {
    const rule = findMatchingRule(name);
    if (rule) {
      return { icon: rule.icon, ...PALETTE[rule.color] };
    }
  }

  if (!categoryName) {
    return {
      icon: Tag,
      badge: "border-border/60 bg-muted text-muted-foreground",
      iconWrap: "bg-muted text-muted-foreground",
    };
  }

  // Unknown category name: deterministic fallback color so the same name
  // always renders the same pill/icon color across renders and sessions.
  return { icon: Tag, ...PALETTE[resolveFallbackColor(name)] };
}

// Effective style for a category that may carry a stored icon/color override
// (Category icon & color picker). The two fields resolve independently: a
// stored value wins per-field when non-null, otherwise that field falls back
// to the same name-derived value `getCategoryStyle` already produces — so a
// category can have a custom color with an auto icon, or vice versa, without
// the two auto-derived halves (which come from the same CATEGORY_RULES
// entry) ever needing to be split apart from each other.
export function resolveEffectiveCategoryStyle(
  categoryName: string | null,
  storedIcon: string | null,
  storedColor: string | null
): CategoryPalette {
  const auto = getCategoryStyle(categoryName);
  const icon =
    storedIcon && storedIcon in ICON_REGISTRY ? ICON_REGISTRY[storedIcon as CategoryIconKey] : auto.icon;
  const paletteColor =
    storedColor && storedColor in PALETTE ? PALETTE[storedColor as CategoryColorKey] : null;

  return {
    icon,
    badge: paletteColor?.badge ?? auto.badge,
    iconWrap: paletteColor?.iconWrap ?? auto.iconWrap,
  };
}
