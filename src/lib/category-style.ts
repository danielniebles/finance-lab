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
  Tag,
  type LucideIcon,
} from "lucide-react";

type CategoryPalette = {
  icon: LucideIcon;
  badge: string;
  iconWrap: string;
};

// Complete literal class strings (not interpolated) so Tailwind's compiler can
// see and generate them — dynamic `bg-${color}-500` templates would not.
const PALETTE = {
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

const FALLBACK_ORDER: (keyof typeof PALETTE)[] = [
  "blue", "violet", "orange", "teal", "pink", "amber", "cyan", "fuchsia", "indigo", "rose",
];

// Keyword → {icon, palette color}. Covers common MoneyLover/AppCategory names
// in both Spanish and English; matching is substring-based on the lowercased
// category name so "Mercado", "Supermercado", "Groceries" all hit the same rule.
const CATEGORY_RULES: { keywords: string[]; icon: LucideIcon; color: keyof typeof PALETTE }[] = [
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

export function getCategoryStyle(categoryName: string | null): CategoryPalette {
  const name = categoryName?.trim().toLowerCase() ?? "";

  if (name) {
    const rule = CATEGORY_RULES.find((r) => r.keywords.some((k) => name.includes(k)));
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
  const color = FALLBACK_ORDER[hashString(name) % FALLBACK_ORDER.length];
  return { icon: Tag, ...PALETTE[color] };
}
