"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

const PATHS = ["/settings/tags", "/expenses"] as const;

function revalidateAll() {
  for (const path of PATHS) revalidatePath(path);
}

// Same normalization as setTransactionTags (actions/transactions.ts) so a
// tag created here and one created inline via the row/create-transaction
// TagsField always collapse to the same row instead of near-duplicates.
function normalizeTagName(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function createTag(data: { name: string; defaultAppCategoryId?: string | null }) {
  const name = normalizeTagName(data.name);
  if (!name) throw new Error("Tag name is required");
  const created = await db.tag.create({
    data: { name, defaultAppCategoryId: data.defaultAppCategoryId || null },
  });
  revalidateAll();
  return created;
}

export async function updateTag(
  id: string,
  data: { name: string; defaultAppCategoryId?: string | null },
) {
  const name = normalizeTagName(data.name);
  if (!name) throw new Error("Tag name is required");
  await db.tag.update({
    where: { id },
    data: { name, defaultAppCategoryId: data.defaultAppCategoryId || null },
  });
  revalidateAll();
}

export async function deleteTag(id: string) {
  await db.tag.delete({ where: { id } });
  revalidateAll();
}
