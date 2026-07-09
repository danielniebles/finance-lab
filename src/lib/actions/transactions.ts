"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { TransactionSource } from "@/generated/prisma";

const PATHS = ["/expenses", "/overview", "/trends"] as const;

function revalidateAll() {
  for (const path of PATHS) revalidatePath(path);
}

/**
 * Creates a bot/manually-captured expense record — the "bot primary" path.
 * Not part of any ImportBatch (batchId null) and not linked to a
 * MoneyLoverCategory; the category is direct via appCategoryId.
 */
export async function createTransaction(data: {
  amount: number;
  date: Date;
  appCategoryId: string;
  wallet: string;
  note?: string;
}) {
  const created = await db.transaction.create({
    data: {
      amount: data.amount,
      date: data.date,
      appCategoryId: data.appCategoryId,
      wallet: data.wallet,
      note: data.note,
      source: TransactionSource.MANUAL,
      batchId: null,
      externalId: null,
      moneyLoverCategoryId: null,
    },
  });
  revalidateAll();
  return created;
}

/** Deletes a transaction (used for undo of a MANUAL add). */
export async function deleteTransaction(id: string) {
  await db.transaction.delete({ where: { id } });
  revalidateAll();
}

/**
 * Patches the category on an already-created transaction — used by
 * applyProposalEdit's approved-and-reversible case (ADR-033): editing an
 * auto-recorded transaction's category from the Telegram notification needs
 * to update the LIVE row, not just a pending proposal's draft params, since
 * the write already happened.
 */
export async function updateTransactionCategory(id: string, appCategoryId: string) {
  await db.transaction.update({ where: { id }, data: { appCategoryId } });
  revalidateAll();
}

/**
 * Resolves the appCategoryId a detaching row should keep when the caller's
 * edit didn't supply a new one — the same ADR-030 resolution rule every read
 * query uses (direct appCategoryId, else the MoneyLoverCategory's mapping),
 * just read off the row being detached instead of aggregated across many.
 *
 * An explicit `null` from the caller means "the user cleared the category" —
 * that intent must be respected as-is, NOT overridden by the fallback chain.
 * The fallback only applies when the key is genuinely absent (`undefined`).
 */
function resolveDetachAppCategoryId(
  data: { appCategoryId?: string | null },
  existing: {
    appCategoryId: string | null;
    moneyLoverCategory: { mapping: { appCategoryId: string } | null } | null;
  },
): string | null {
  if (data.appCategoryId !== undefined) return data.appCategoryId;
  return existing.appCategoryId ?? existing.moneyLoverCategory?.mapping?.appCategoryId ?? null;
}

/**
 * Patches an arbitrary set of editable fields on a transaction — the Ledger
 * view's row-edit action (ADR-035).
 *
 * Detach-on-edit rule: editing a MONEYLOVER row makes the user's edit
 * authoritative and flips it to MANUAL (`batchId`/`moneyLoverCategoryId`
 * nulled), so a future re-import of that month can't silently overwrite it —
 * the existing import dedup (ADR-030, day+exact-amount match against MANUAL
 * rows) then correctly treats it as already-captured. A MANUAL row is edited
 * in place with no source flip. `appCategoryId` distinguishes three caller
 * intents: omitted (`undefined`) leaves it untouched on a MANUAL row / applies
 * the detach fallback-resolution on a detaching row; an explicit `string`
 * sets it directly; an explicit `null` clears it (Prisma only treats an
 * explicit `null` as "clear this field" — an `undefined` key is "not
 * provided," so the caller's "no category" intent must reach here as `null`,
 * never `undefined`). A detaching row with neither a direct category nor a
 * resolvable mapping (an uncategorized MoneyLover row) is left with
 * appCategoryId null — the schema permits this, so no error is raised.
 */
export async function updateTransaction(
  id: string,
  data: {
    amount?: number;
    date?: Date;
    appCategoryId?: string | null;
    wallet?: string;
    note?: string | null;
  },
) {
  const existing = await db.transaction.findUniqueOrThrow({
    where: { id },
    select: {
      source: true,
      appCategoryId: true,
      moneyLoverCategory: { select: { mapping: { select: { appCategoryId: true } } } },
    },
  });

  const detachFields =
    existing.source === TransactionSource.MONEYLOVER
      ? {
          source: TransactionSource.MANUAL,
          batchId: null,
          moneyLoverCategoryId: null,
          appCategoryId: resolveDetachAppCategoryId(data, existing),
        }
      : {};

  await db.transaction.update({ where: { id }, data: { ...data, ...detachFields } });
  revalidateAll();
}
