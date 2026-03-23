"use server";

import { db } from "@/lib/db";
import { BudgetType } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";

export async function createAppCategory(data: {
  name: string;
  budgetType: BudgetType;
  monthlyBudget: number;
}) {
  await db.appCategory.create({ data });
  revalidatePath("/settings/categories");
}

export async function updateAppCategory(
  id: string,
  data: { name?: string; budgetType?: BudgetType; monthlyBudget?: number }
) {
  await db.appCategory.update({ where: { id }, data });
  revalidatePath("/settings/categories");
}

export async function deleteAppCategory(id: string) {
  await db.appCategory.delete({ where: { id } });
  revalidatePath("/settings/categories");
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
