// Transaction proposal resolver (propose_add_transaction). Mirrors the shape
// of proposals/accounts.ts: name resolution against real data, blockingProposal
// / buildResolvedProposal from ./shared. The one addition over accounts.ts:
// this resolver also builds the `editable` shortlist for the category field
// (ADR-031) — category is never a blocking field here, since the whole point
// of the one-shot bank-message flow (Part D / prompt.ts) is zero clarifying
// questions for category; an unresolved guess just falls back to a default.

import { getCategories, type CategoryOption } from "@/lib/queries/expenses";
import { formatCOP } from "@/lib/format";
import { blockingProposal, buildResolvedProposal, type ResolvedProposal } from "./shared";
import type { EditableOption } from "../types";

const OTHER_OPTION: EditableOption = { id: "__other__", label: "Otra…" };
const SHORTLIST_SIZE = 5; // resolved guess + up to 4 more, then __other__

/**
 * Resolve `appCategoryName` (the model's guess) to a real AppCategory id.
 * Case-insensitive exact match first, then partial/contains match — same
 * order as proposals/loans.ts's resolveCreateLoan name resolution. Falls back
 * to the first category alphabetically when the name is missing or matches
 * nothing — never blocks, since category is editable on the card.
 */
function resolveCategoryGuess(
  categories: CategoryOption[],
  appCategoryName: string | undefined,
): CategoryOption {
  const name = appCategoryName?.toLowerCase().trim();
  if (name) {
    const exact = categories.find((c) => c.name.toLowerCase() === name);
    if (exact) return exact;
    const partial = categories.find((c) => c.name.toLowerCase().includes(name));
    if (partial) return partial;
  }
  return categories[0];
}

/**
 * Build the editable shortlist: the resolved guess first, then a few more
 * categories (alphabetically, since getCategories() is already name-sorted —
 * simplest heuristic that doesn't need extra usage-tracking for v1), then the
 * synthetic "Otra…" option always last.
 */
function buildCategoryShortlist(
  categories: CategoryOption[],
  guess: CategoryOption,
): EditableOption[] {
  const rest = categories.filter((c) => c.id !== guess.id).slice(0, SHORTLIST_SIZE - 1);
  const options = [guess, ...rest].map((c) => ({ id: c.id, label: c.name }));
  return [...options, OTHER_OPTION];
}

export async function resolveAddTransaction(
  input: Record<string, unknown>,
): Promise<ResolvedProposal> {
  const amount = Number(input.amount);
  const date = (input.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const appCategoryName = input.appCategoryName as string | undefined;
  const wallet = (input.wallet as string | undefined) ?? "—";
  const note = input.note as string | undefined;

  const categories = await getCategories();
  if (categories.length === 0) {
    return blockingProposal(
      "Add transaction",
      "No categories exist yet. Ask the user to create at least one AppCategory in Settings before adding transactions.",
      input,
    );
  }
  const guess = resolveCategoryGuess(categories, appCategoryName);

  const params: Record<string, unknown> = {
    amount,
    date,
    appCategoryId: guess.id,
    wallet,
    note: note ?? null,
  };

  const direction = amount < 0 ? "expense" : "income";
  const title = `Add ${direction}: ${wallet} — ${formatCOP(Math.abs(amount))}`;
  const fields: { label: string; value: string }[] = [
    { label: "Amount", value: formatCOP(amount) },
    { label: "Date", value: date },
    { label: "Wallet", value: wallet },
    { label: "Notes", value: note ?? "—" },
  ];

  const editable: EditableOption[] = buildCategoryShortlist(categories, guess);

  return buildResolvedProposal(params, title, fields, [
    {
      field: "appCategoryId",
      label: "Categoría",
      selectedId: guess.id,
      options: editable,
    },
  ]);
}
