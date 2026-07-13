// Zero-dependency leaf module: the closed key lists for AppCategory.icon/color
// (Category icon & color picker). No Lucide imports, no Tailwind class
// strings — safe for both the presentational resolver (category-style.ts,
// which maps these keys to icons/classes) and the Server Action layer
// (src/lib/actions/categories.ts, which validates against these keys) to
// import without either pulling in the other's dependencies.
//
// This is the single source of truth for both lists — do not redeclare them
// elsewhere. `Tag` is deliberately excluded from CATEGORY_ICON_KEYS: it stays
// reserved as category-style.ts's presentational null/unmatched-name
// fallback icon and is never a storable override.

export const CATEGORY_ICON_KEYS = [
  "shopping-cart",
  "utensils-crossed",
  "bus",
  "receipt",
  "heart-pulse",
  "plane",
  "shopping-bag",
  "film",
  "graduation-cap",
  "home",
  "smartphone",
  "dumbbell",
  "gift",
  "paw-print",
  "landmark",
  "wallet",
  "beef",
  "fish",
  "carrot",
  "paintbrush-vertical",
  "briefcase-medical",
  "drama",
  "gamepad-2",
  "hand-heart",
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

export const CATEGORY_COLOR_KEYS = [
  "emerald",
  "orange",
  "blue",
  "violet",
  "rose",
  "cyan",
  "pink",
  "fuchsia",
  "amber",
  "teal",
  "indigo",
] as const;

export type CategoryColorKey = (typeof CATEGORY_COLOR_KEYS)[number];
