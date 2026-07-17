"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { RuleMatchType, RuleDirection } from "@/generated/prisma";
import { normalizeMatchValue } from "@/lib/normalize-match-value";
import { resolveWalletFields } from "@/lib/resolve-wallet";

const PATH = "/settings/rules";

/**
 * Both `wallet` (required legacy label) and `walletId` (optional curated
 * Wallet.id, ADR-036/037-style upgrade mirroring Transaction) are accepted.
 * `resolveWalletFields` resolves them together: a supplied `walletId` wins
 * and its Wallet's name overwrites `wallet`; otherwise `wallet` alone is
 * resolved to a `walletId` via the collision-prone name-based
 * `resolveWalletId()` — the same fallback the agent's rule-CRUD proposal
 * flow relies on today, since it only ever has a free-text label to work
 * with (no curated wallet id in natural-language input).
 */
export async function createCounterpartyRule(data: {
  matchType: RuleMatchType;
  matchValue: string;
  direction?: RuleDirection;
  appCategoryId: string;
  wallet: string;
  walletId?: string;
  autoRecord?: boolean;
  recurring?: boolean;
  expectedAmount?: number;
  notes?: string;
}) {
  const walletFields = await resolveWalletFields({ wallet: data.wallet, walletId: data.walletId });
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
      ...walletFields,
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
    walletId?: string;
    autoRecord?: boolean;
    recurring?: boolean;
    expectedAmount?: number | null;
    notes?: string | null;
  },
) {
  const walletFields = await resolveWalletFields({ wallet: data.wallet, walletId: data.walletId });
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
      ...walletFields,
    },
  });
  revalidatePath(PATH);
  return updated;
}

export async function deleteCounterpartyRule(id: string) {
  await db.counterpartyRule.delete({ where: { id } });
  revalidatePath(PATH);
}
