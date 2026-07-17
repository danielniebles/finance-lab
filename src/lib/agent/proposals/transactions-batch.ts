// Batch proposal resolver for propose_add_transactions_batch (ADR-034 —
// credit-card screenshot ingestion). Mirrors proposals/transactions.ts's
// shape (category guess/shortlist reused verbatim, exported from there) but
// resolves a whole LIST of items instead of one, and additionally resolves a
// batch-level `cardLabel` (→ every included item's wallet) with its own
// shortlist.
//
// Per-item category resolution: a counterparty rule lookup by vendor first
// (treating `vendor` as the MERCHANT candidate, direction always EXPENSE —
// card purchases are never income), falling back to the same no-name guess
// resolveCategoryGuess/buildCategoryShortlist already give a normal
// propose_add_transaction card when no rule matches and no name was given.
// Only the rule's appCategoryId is borrowed — NOT its wallet: every included
// row's wallet is the batch-level cardLabel, a deliberate difference from the
// single-transaction ADR-033 auto-record flow (see docs/decisions.md ADR-034).

import { getCategories } from "@/lib/queries/expenses";
import { matchCounterpartyRule } from "@/lib/queries/counterparty-rules";
import { getCardSummaries } from "@/lib/queries/installments";
import { formatCOP } from "@/lib/format";
import { blockingProposal, buildResolvedProposal, type ResolvedProposal } from "./shared";
import { resolveCategoryGuess } from "./transactions";
import type { BatchDescriptor, BatchItem } from "../types";

const OTHER_CARD_OPTION = { id: "__other__", label: "Other…" };

type RawBatchItem = {
  vendor?: string;
  amount?: number;
  date?: string;
  scratched?: boolean;
};

/**
 * Resolves one raw vision-extracted item into a BatchItem: category from a
 * matching counterparty rule (by vendor, direction always EXPENSE — card
 * purchases are never income) or, failing that, the same no-name fallback
 * guess resolveAddTransaction's normal card uses. `included` is purely
 * `!scratched` — scratch-out detection is entirely the model's job, this
 * resolver only reads whatever boolean it sent.
 */
async function resolveBatchItem(
  raw: RawBatchItem,
  categories: Awaited<ReturnType<typeof getCategories>>,
): Promise<BatchItem> {
  const vendor = raw.vendor ?? "?";
  const amount = Number(raw.amount);

  const rule = await matchCounterpartyRule({
    merchant: vendor,
    direction: "EXPENSE",
  });

  const appCategoryId = rule
    ? rule.appCategoryId
    : resolveCategoryGuess(categories, undefined).id;

  return {
    vendor,
    amount,
    date: raw.date,
    appCategoryId,
    included: !raw.scratched,
    ...(raw.scratched ? { scratchDetected: true } : {}),
  };
}

/**
 * Card-label shortlist: reuses the existing Installments-module CreditCard
 * names if any exist (a cheap, already-there fit — no new entity), otherwise
 * degrades to just the model's guessed/default label plus a synthetic
 * "Other…", mirroring the category shortlist's degrade pattern. There is no
 * first-class Wallet model — `wallet` stays a free-text label everywhere in
 * this codebase (Transaction.wallet, CounterpartyRule.wallet).
 */
async function buildCardLabelOptions(
  defaultLabel: string,
): Promise<{ id: string; label: string }[]> {
  const now = new Date();
  const cards = await getCardSummaries(now.getMonth() + 1, now.getFullYear());

  if (cards.length > 0) {
    const options = cards.map((c) => ({ id: c.name, label: c.name }));
    const hasDefault = options.some((o) => o.id === defaultLabel);
    return [
      ...(hasDefault ? [] : [{ id: defaultLabel, label: defaultLabel }]),
      ...options,
      OTHER_CARD_OPTION,
    ];
  }

  return [{ id: defaultLabel, label: defaultLabel }, OTHER_CARD_OPTION];
}

function formatItemLine(item: BatchItem, categoryLabel: string): string {
  const marker = item.included ? "✓" : "✕ (crossed out)";
  return `${marker} ${item.vendor} ${formatCOP(-Math.abs(item.amount))} → ${categoryLabel}`;
}

/** Sum of |amount| across included items only — the "move to pocket" total. */
export function computeBatchTotal(batch: BatchDescriptor): number {
  return batch.items.filter((i) => i.included).reduce((sum, i) => sum + Math.abs(i.amount), 0);
}

/**
 * Builds title + fields from the CURRENT batch state. Used both at
 * proposal-creation time and after every batch mutation (toggle/edit
 * category/set card label) so the re-rendered card is always derived from
 * one place — exported for apply-batch-edit.ts.
 */
export function buildBatchDisplay(
  batch: BatchDescriptor,
): { title: string; fields: { label: string; value: string }[] } {
  const includedCount = batch.items.filter((i) => i.included).length;
  const total = computeBatchTotal(batch);
  const title = `Add transactions batch: ${batch.cardLabel} — ${includedCount} items, ${formatCOP(total)}`;

  const categoryById = new Map(batch.categoryOptions.map((c) => [c.id, c.label]));
  const lines = batch.items.map((item) =>
    formatItemLine(item, categoryById.get(item.appCategoryId) ?? "?"),
  );
  const fields: { label: string; value: string }[] = [
    { label: "Card", value: batch.cardLabel },
    { label: "Transactions", value: lines.join("\n") },
    { label: "Included", value: `${includedCount}` },
    { label: "Total", value: formatCOP(total) },
  ];

  return { title, fields };
}

export async function resolveAddTransactionsBatch(
  input: Record<string, unknown>,
): Promise<ResolvedProposal> {
  const rawItems = (input.items as RawBatchItem[] | undefined) ?? [];
  const cardLabel = (input.cardLabel as string | undefined) ?? "Card";

  if (rawItems.length === 0) {
    return blockingProposal(
      "Add transactions batch",
      "No items were extracted from the screenshot. Ask the user to resend a clearer photo.",
      input,
    );
  }

  const categories = await getCategories();
  if (categories.length === 0) {
    return blockingProposal(
      "Add transactions batch",
      "No categories exist yet. Ask the user to create at least one AppCategory in Settings before adding transactions.",
      input,
    );
  }

  const items = await Promise.all(rawItems.map((raw) => resolveBatchItem(raw, categories)));
  const categoryOptions = categories.map((c) => ({ id: c.id, label: c.name }));
  const cardLabelOptions = await buildCardLabelOptions(cardLabel);

  const batch: BatchDescriptor = {
    cardLabel,
    items,
    categoryOptions,
    cardLabelOptions,
  };

  const params: Record<string, unknown> = { batch };
  const { title, fields } = buildBatchDisplay(batch);

  return buildResolvedProposal(params, title, fields);
}
