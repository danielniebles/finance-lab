import { db } from "@/lib/db";

export type TagOption = { id: string; name: string; color: string | null };

export async function getTags(): Promise<TagOption[]> {
  return db.tag.findMany({
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });
}

export type TagMatch = { id: string; name: string; defaultAppCategoryId: string | null };

// Bot hashtag resolution (proposals/transactions.ts) — looks up whichever of
// the given (already-normalized) names exist as real Tag rows, so an
// unmatched hashtag isn't an error, just a tag that'll be created on the fly
// at write time (setTransactionTags' connectOrCreate), same as manual entry.
export async function getTagsByNames(names: string[]): Promise<TagMatch[]> {
  if (names.length === 0) return [];
  return db.tag.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true, defaultAppCategoryId: true },
  });
}

export type TagSettingsRow = {
  id: string;
  name: string;
  defaultAppCategoryId: string | null;
  defaultAppCategoryName: string | null;
  transactionCount: number;
};

// Settings/tags page listing — adds the default-category hint and usage
// count getTags() (the lightweight ledger-filter option list) doesn't need.
export async function getTagsForSettings(): Promise<TagSettingsRow[]> {
  const rows = await db.tag.findMany({
    orderBy: { name: "asc" },
    include: {
      defaultAppCategory: { select: { name: true } },
      _count: { select: { transactions: true } },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    defaultAppCategoryId: t.defaultAppCategoryId,
    defaultAppCategoryName: t.defaultAppCategory?.name ?? null,
    transactionCount: t._count.transactions,
  }));
}
