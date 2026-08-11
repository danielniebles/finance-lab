"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { TransactionSource } from "@/generated/prisma";
import { resolveWalletId, resolveWalletFields } from "@/lib/resolve-wallet";

const PATHS = ["/expenses", "/overview", "/trends"] as const;

function revalidateAll() {
  for (const path of PATHS) revalidatePath(path);
}

/**
 * Creates a bot/manually-captured expense record — the "bot primary" path.
 * Not part of any ImportBatch (batchId null) and not linked to a
 * MoneyLoverCategory; the category is direct via appCategoryId.
 *
 * This is the choke point for walletId resolution (ADR-036/037, HANDOFF
 * §3b): every caller here (the agent's propose_add_transaction, counterparty
 * auto-record) gets a resolved walletId for free. The two write sites that
 * bypass this helper (import.ts's createMany, the batch card-screenshot
 * create) replicate the same resolveWalletId() rule inline.
 */
export async function createTransaction(data: {
  amount: number;
  date: Date;
  appCategoryId: string;
  wallet: string;
  /**
   * When the caller already knows the exact Wallet.id (e.g. a curated dropdown
   * sourced from getWalletBalances()), pass it here to skip the ambiguous
   * name-based resolution entirely — Wallet names are only unique per
   * SavingsAccount (`@@unique([accountId, name])`), so resolveWalletId()'s
   * global case-insensitive name lookup can collide across accounts.
   */
  walletId?: string;
  note?: string;
}) {
  const walletId = data.walletId ?? (await resolveWalletId(data.wallet));
  const created = await db.transaction.create({
    data: {
      amount: data.amount,
      date: data.date,
      appCategoryId: data.appCategoryId,
      wallet: data.wallet,
      walletId,
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
    /**
     * When the caller already knows the exact Wallet.id (e.g. a curated
     * dropdown sourced from getWalletBalances()), pass it here to skip the
     * ambiguous name-based resolution entirely — Wallet names are only
     * unique per SavingsAccount (`@@unique([accountId, name])`), so
     * resolveWalletId()'s global case-insensitive name lookup can collide
     * across accounts. Callers that still only have a free-text label
     * (bot/Telegram capture, counterparty auto-record) keep passing `wallet`
     * and go through resolveWalletId() as before. See `resolveWalletFields`
     * for how the legacy `wallet` text column is kept in sync either way.
     */
    walletId?: string;
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

  // Re-resolve walletId (ADR-036/037) when the wallet label itself changes —
  // otherwise an edited row would keep pointing at its old wallet's balance.
  const walletFields = await resolveWalletFields(data);

  await db.transaction.update({ where: { id }, data: { ...data, ...detachFields, ...walletFields } });
  revalidateAll();
}

// ─── Tags ───────────────────────────────────────────────────────────────────

// Canonical storage form so "#Uber" and "uber " resolve to the same Tag row —
// mirrors normalizeMatchValue's trim (used for CounterpartyRule's
// MERCHANT/SENDER/KEYWORD fields), lowercased instead of uppercased since
// these read as hashtags, not bank-message fields.
function normalizeTagName(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Replaces a transaction's full tag set — the ledger row editor's save path.
 * Unknown names are created on the fly (connectOrCreate), so tagging is a
 * single soft action with no separate "create a tag first" step. `set: []`
 * clears anything not in the new list, so this fully replaces rather than
 * merges — callers passing an empty array untag the transaction entirely.
 */
export async function setTransactionTags(transactionId: string, tagNames: string[]) {
  const names = [...new Set(tagNames.map(normalizeTagName).filter(Boolean))];
  await db.transaction.update({
    where: { id: transactionId },
    data: {
      tags: {
        set: [],
        connectOrCreate: names.map((name) => ({ where: { name }, create: { name } })),
      },
    },
  });
  revalidateAll();
}

// ─── Suggestions (AddTransactionRow autofill) ──────────────────────────────

export type TransactionSuggestion = {
  appCategoryId: string;
  categoryName: string;
  walletId: string;
  walletName: string;
  source: "note" | "amount";
  sampleCount: number;
  // The complementary field to whichever one drove the match — signed amount
  // (same convention as Transaction.amount) when source is "note", or a note
  // when source is "amount". Undefined when there's nothing to suggest back
  // (e.g. the matched rows have no note) or the field isn't the complement
  // (a note-sourced suggestion never carries a note, it's already known).
  amount?: number;
  note?: string;
};

// Selects everything needed to resolve a transaction's *effective* category
// the same way every other read in the app does (ADR-030): direct
// appCategoryId if set, else the linked MoneyLoverCategory's mapping. Most
// rows are MONEYLOVER-sourced with appCategoryId null, so skipping this
// fallback would starve the suggestion of nearly all historical data.
const SUGGESTION_ROW_SELECT = {
  amount: true,
  note: true,
  appCategoryId: true,
  walletId: true,
  appCategory: { select: { name: true } },
  walletRef: { select: { name: true } },
  moneyLoverCategory: {
    select: { mapping: { select: { appCategoryId: true, appCategory: { select: { name: true } } } } },
  },
} as const;

type SuggestionCandidateRow = {
  amount: number;
  note: string | null;
  appCategoryId: string | null;
  walletId: string | null;
  appCategory: { name: string } | null;
  walletRef: { name: string } | null;
  moneyLoverCategory: { mapping: { appCategoryId: string; appCategory: { name: string } } | null } | null;
};

const SUGGESTION_SAMPLE_SIZE = 20;
const AMOUNT_TOLERANCE_RATIO = 0.03;

function resolveEffectiveCategory(row: SuggestionCandidateRow): { id: string; name: string } | null {
  if (row.appCategoryId && row.appCategory) return { id: row.appCategoryId, name: row.appCategory.name };
  const mapped = row.moneyLoverCategory?.mapping;
  return mapped ? { id: mapped.appCategoryId, name: mapped.appCategory.name } : null;
}

/** Groups candidate rows by (category, wallet) pair and returns the most
 * frequent combination — ties favor the most recent (rows arrive date-desc).
 * The representative row kept per group is the first one seen (i.e. most
 * recent, since rows arrive date-desc), and supplies the complementary
 * amount/note suggested alongside the category + wallet. */
function pickMajoritySuggestion(
  rows: SuggestionCandidateRow[],
  source: "note" | "amount",
): TransactionSuggestion | null {
  const counts = new Map<
    string,
    {
      count: number;
      category: { id: string; name: string };
      walletId: string;
      walletName: string;
      amount: number;
      note: string | null;
    }
  >();
  for (const row of rows) {
    const category = resolveEffectiveCategory(row);
    if (!category || !row.walletId || !row.walletRef) continue;
    const key = `${category.id}|${row.walletId}`;
    const existing = counts.get(key);
    if (existing) existing.count++;
    else {
      counts.set(key, {
        count: 1,
        category,
        walletId: row.walletId,
        walletName: row.walletRef.name,
        amount: row.amount,
        note: row.note,
      });
    }
  }
  if (counts.size === 0) return null;

  const best = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  return {
    appCategoryId: best.category.id,
    categoryName: best.category.name,
    walletId: best.walletId,
    walletName: best.walletName,
    source,
    sampleCount: best.count,
    amount: source === "note" ? best.amount : undefined,
    note: source === "amount" && best.note ? best.note : undefined,
  };
}

async function suggestFromNote(note: string): Promise<TransactionSuggestion | null> {
  const rows = await db.transaction.findMany({
    where: { note: { contains: note, mode: "insensitive" } },
    orderBy: { date: "desc" },
    take: SUGGESTION_SAMPLE_SIZE,
    select: SUGGESTION_ROW_SELECT,
  });
  return pickMajoritySuggestion(rows, "note");
}

async function suggestFromAmount(amount: number): Promise<TransactionSuggestion | null> {
  const tolerance = Math.abs(amount) * AMOUNT_TOLERANCE_RATIO;
  const rows = await db.transaction.findMany({
    where: { amount: { gte: amount - tolerance, lte: amount + tolerance } },
    orderBy: { date: "desc" },
    take: SUGGESTION_SAMPLE_SIZE,
    select: SUGGESTION_ROW_SELECT,
  });
  return pickMajoritySuggestion(rows, "amount");
}

/**
 * AddTransactionRow autofill: given the note typed so far and/or the signed
 * amount (same sign convention as Transaction.amount — negative = expense),
 * looks at past transactions to suggest a category + wallet. Note match is
 * tried first (more specific — e.g. "Rappi" matches prior "Rappi delivery"
 * rows regardless of amount), falling back to an amount-tolerance match
 * (±3%) when the note is too short or has no history. Caller decides whether
 * to show this as a dismissible suggestion vs. auto-apply it.
 */
export async function suggestTransactionFields(input: {
  amount?: number;
  note?: string;
}): Promise<TransactionSuggestion | null> {
  const note = input.note?.trim();
  if (note && note.length >= 3) {
    const noteSuggestion = await suggestFromNote(note);
    if (noteSuggestion) return noteSuggestion;
  }

  if (input.amount !== undefined && !Number.isNaN(input.amount) && input.amount !== 0) {
    return suggestFromAmount(input.amount);
  }

  return null;
}
