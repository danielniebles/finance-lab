// Single source of truth for "what color does this financial state get".
//
// Before this module, every screen mapped its own domain statuses to classes
// (vault-tile, goals-card, recurring-list, vault-due-banner,
// category-breakdown-table, overview KPIs …), with small drifts between them
// and a few hard-coded oklch() values that ignored the active theme. Domain
// code now maps its status to a `Tone`; the design-system components
// (StatusChip, Meter, Money, StatCard) turn a Tone into token-based classes,
// so every theme (default/Signal × light/dark) is respected automatically.
//
// Client-safe: type-only imports, no DB access.

import type { CategorySeverity } from "@/lib/queries/expenses";
import type { VaultStatus } from "@/lib/vault-utils";
import type { RecurringExpenseRow } from "@/lib/queries/recurring";

export type Tone =
  | "positive" // on track, paid, met, income
  | "caution" // drifting: issue, behind, underfunded, due soon
  | "danger" // overspent, overdue, critical
  | "unplanned" // spend with no budget (theme decides: amber or indigo)
  | "info" // informational, neither good nor bad
  | "neutral"; // no status — plain foreground / muted

type ToneClasses = {
  /** Foreground text in this tone. */
  text: string;
  /** Soft tinted background + text, for chips and icon tiles. */
  soft: string;
  /** Solid fill, for meter bars and dots. */
  fill: string;
  /** CSS color value, for SVG strokes/fills (charts, rings). */
  color: string;
};

// Complete literal class strings so Tailwind can see them at build time.
export const TONE_CLASSES: Record<Tone, ToneClasses> = {
  positive: {
    text: "text-success",
    soft: "bg-success/10 text-success",
    fill: "bg-success",
    color: "var(--success)",
  },
  caution: {
    text: "text-warning",
    soft: "bg-warning/10 text-warning",
    fill: "bg-warning",
    color: "var(--warning)",
  },
  danger: {
    text: "text-destructive",
    soft: "bg-destructive/10 text-destructive",
    fill: "bg-destructive",
    color: "var(--destructive)",
  },
  unplanned: {
    text: "text-unplanned",
    soft: "bg-unplanned/10 text-unplanned",
    fill: "bg-unplanned",
    color: "var(--unplanned)",
  },
  info: {
    text: "text-info",
    soft: "bg-info/10 text-info",
    fill: "bg-info",
    color: "var(--info)",
  },
  neutral: {
    text: "text-foreground",
    soft: "bg-muted text-muted-foreground",
    fill: "bg-muted-foreground",
    color: "var(--muted-foreground)",
  },
};

// ─── Domain → Tone mappings ───────────────────────────────────────────────────

export function toneForCategorySeverity(severity: CategorySeverity): Tone {
  switch (severity) {
    case "OK":
      return "positive";
    case "Issue":
      return "caution";
    case "Critical":
      return "danger";
    case "Unplanned":
      return "unplanned";
  }
}

export function toneForVaultStatus(status: VaultStatus): Tone {
  switch (status) {
    case "Met":
    case "On track":
      return "positive";
    case "Behind":
    case "Underfunded":
      return "caution";
    case "Overdue":
      return "danger";
    case "Open":
      return "neutral";
  }
}

export function toneForRecurringStatus(status: RecurringExpenseRow["status"]): Tone {
  switch (status) {
    case "Funded":
      return "positive";
    case "Underfunded":
    case "DueSoon":
      return "caution";
    case "Overdue":
      return "danger";
  }
}

/** Percent of a budget used: ≥100 over, ≥80 close, else fine. */
export function toneForBudgetUsed(percentUsed: number): Tone {
  if (percentUsed >= 100) return "danger";
  if (percentUsed >= 80) return "caution";
  return "positive";
}

export const SAVINGS_RATE_TARGET = 20;

/** Savings rate in %: at/above target good, half the target or more caution. */
export function toneForSavingsRate(rate: number | null): Tone {
  if (rate === null) return "neutral";
  if (rate >= SAVINGS_RATE_TARGET) return "positive";
  if (rate >= SAVINGS_RATE_TARGET / 2) return "caution";
  return "danger";
}
