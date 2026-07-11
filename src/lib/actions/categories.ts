"use server";

import { db } from "@/lib/db";
import { BudgetType } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { CATEGORY_ICON_KEYS, CATEGORY_COLOR_KEYS } from "@/lib/category-keys";

const CATEGORIES_PATH = "/settings/categories";

export async function createAppCategory(data: { name: string }) {
  await db.appCategory.create({ data });
  revalidatePath(CATEGORIES_PATH);
}

export async function updateAppCategory(id: string, data: { name: string }) {
  await db.appCategory.update({ where: { id }, data });
  revalidatePath(CATEGORIES_PATH);
}

// Closed key lists for AppCategory.icon/color (Category icon & color picker).
// Sourced from src/lib/category-keys.ts — the single, zero-dependency source
// of truth shared with category-style.ts (Frontend's resolver) — so this
// action layer stays in compiler-enforced sync with the picker's registries
// without importing that presentational module (Lucide components/Tailwind
// class strings). Both lists are validated server-side because this is a
// Server Action, callable directly regardless of what the picker UI renders.

function assertValidCategoryIcon(icon: string | null | undefined) {
  if (icon == null) return;
  if (!(CATEGORY_ICON_KEYS as readonly string[]).includes(icon)) {
    throw new Error(`Invalid category icon key: "${icon}"`);
  }
}

function assertValidCategoryColor(color: string | null | undefined) {
  if (color == null) return;
  if (!(CATEGORY_COLOR_KEYS as readonly string[]).includes(color)) {
    throw new Error(`Invalid category color key: "${color}"`);
  }
}

// Kept separate from updateAppCategory (name-edit) per the design spec's
// Dialog-vs-inline split: the picker's Save action always writes both fields
// together (each independently nullable — null resets that field to auto).
export async function updateAppCategoryStyle(
  id: string,
  data: { icon?: string | null; color?: string | null },
) {
  assertValidCategoryIcon(data.icon);
  assertValidCategoryColor(data.color);
  await db.appCategory.update({ where: { id }, data });
  revalidatePath(CATEGORIES_PATH);
  revalidatePath("/expenses");
}

export async function deleteAppCategory(id: string) {
  await db.appCategory.delete({ where: { id } });
  revalidatePath(CATEGORIES_PATH);
}

export async function createBudgetItem(
  appCategoryId: string,
  data: { name: string; amount: number; budgetType: BudgetType }
) {
  await db.budgetItem.create({ data: { appCategoryId, ...data } });
  revalidatePath(CATEGORIES_PATH);
  revalidatePath("/expenses");
}

export async function updateBudgetItem(
  id: string,
  data: { name: string; amount: number; budgetType: BudgetType }
) {
  await db.budgetItem.update({ where: { id }, data });
  revalidatePath(CATEGORIES_PATH);
  revalidatePath("/expenses");
}

export async function deleteBudgetItem(id: string) {
  await db.budgetItem.delete({ where: { id } });
  revalidatePath(CATEGORIES_PATH);
  revalidatePath("/expenses");
}

export async function saveCategoryMapping(
  moneyLoverCategoryId: string,
  appCategoryId: string
) {
  await db.categoryMapping.upsert({
    where: { moneyLoverCategoryId },
    update: { appCategoryId },
    create: { moneyLoverCategoryId, appCategoryId },
  });
  revalidatePath("/settings/mappings");
  revalidatePath("/expenses");
}

export async function deleteCategoryMapping(moneyLoverCategoryId: string) {
  await db.categoryMapping.deleteMany({ where: { moneyLoverCategoryId } });
  revalidatePath("/settings/mappings");
}
