import type { BudgetType } from "@/generated/prisma";

export type BudgetItemData = {
  id: string;
  name: string;
  amount: number;
  budgetType: BudgetType;
  /** Paid once a month — listed in Pay bills (ADR-052). */
  isBill: boolean;
};

/** A category as the Settings page loads it (findMany with budget items + mapping count). */
export type SettingsCategory = {
  id: string;
  name: string;
  /** Style overrides; null = derived from the name (category-style.ts). */
  icon: string | null;
  color: string | null;
  budgetItems: BudgetItemData[];
  _count: { mappings: number };
};
