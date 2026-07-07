"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { RuleMatchType, RuleDirection } from "@/generated/prisma";
import { normalizeMatchValue } from "@/lib/normalize-match-value";

const PATH = "/settings/rules";

export async function createCounterpartyRule(data: {
  matchType: RuleMatchType;
  matchValue: string;
  direction?: RuleDirection;
  appCategoryId: string;
  wallet: string;
  autoRecord?: boolean;
  recurring?: boolean;
  expectedAmount?: number;
  notes?: string;
}) {
  const created = await db.counterpartyRule.create({
    data: {
      matchType: data.matchType,
      matchValue: normalizeMatchValue(data.matchType, data.matchValue),
      direction: data.direction,
      appCategoryId: data.appCategoryId,
      wallet: data.wallet,
      autoRecord: data.autoRecord,
      recurring: data.recurring,
      expectedAmount: data.expectedAmount,
      notes: data.notes,
    },
  });
  revalidatePath(PATH);
  return created;
}

export async function updateCounterpartyRule(
  id: string,
  data: {
    matchType: RuleMatchType;
    matchValue: string;
    direction?: RuleDirection;
    appCategoryId: string;
    wallet: string;
    autoRecord?: boolean;
    recurring?: boolean;
    expectedAmount?: number | null;
    notes?: string | null;
  },
) {
  const updated = await db.counterpartyRule.update({
    where: { id },
    data: {
      matchType: data.matchType,
      matchValue: normalizeMatchValue(data.matchType, data.matchValue),
      direction: data.direction,
      appCategoryId: data.appCategoryId,
      wallet: data.wallet,
      autoRecord: data.autoRecord,
      recurring: data.recurring,
      expectedAmount: data.expectedAmount,
      notes: data.notes,
    },
  });
  revalidatePath(PATH);
  return updated;
}

export async function deleteCounterpartyRule(id: string) {
  await db.counterpartyRule.delete({ where: { id } });
  revalidatePath(PATH);
}
