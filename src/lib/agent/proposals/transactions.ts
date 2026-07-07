// Transaction proposal resolver (propose_add_transaction). Mirrors the shape
// of proposals/accounts.ts: name resolution against real data, blockingProposal
// / buildResolvedProposal from ./shared. Two additions over accounts.ts:
// this resolver also builds the `editable` shortlist for the category field
// (ADR-031) — category is never a blocking field here, since the whole point
// of the one-shot bank-message flow (Part D / prompt.ts) is zero clarifying
// questions for category; an unresolved guess just falls back to a default —
// and it consults CounterpartyRule matches (ADR-033): on a confident,
// autoRecord-eligible match, it short-circuits into the auto-record path
// instead of building a normal editable card.

import { getCategories, type CategoryOption } from "@/lib/queries/expenses";
import { matchCounterpartyRule } from "@/lib/queries/counterparty-rules";
import { formatCOP } from "@/lib/format";
import { blockingProposal, buildResolvedProposal, type ResolvedProposal } from "./shared";
import type { EditableOption } from "../types";
import { autoRecordFromRule, isConfidentTransaction } from "../auto-record-transaction";

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

/**
 * Looks up a CounterpartyRule from whichever extraction fields the model
 * populated on this turn (counterpartyAccount/Merchant/Sender + direction).
 * Returns null immediately if no candidate field is present at all — the
 * common case for a typed-in-chat transaction with no bank-message
 * counterparty to extract.
 */
async function lookupRuleFromInput(input: Record<string, unknown>, amount: number) {
  const account = input.counterpartyAccount as string | undefined;
  const merchant = input.counterpartyMerchant as string | undefined;
  const sender = input.counterpartySender as string | undefined;
  if (!account && !merchant && !sender) return null;

  const direction =
    (input.direction as "expense" | "income" | undefined) ?? (amount < 0 ? "expense" : "income");

  return matchCounterpartyRule({
    account,
    merchant,
    sender,
    direction: direction === "income" ? "INCOME" : "EXPENSE",
  });
}

type NormalCardArgs = {
  input: Record<string, unknown>;
  amount: number;
  date: string;
  wallet: string;
  note: string | undefined;
  hadCounterpartyMatch: boolean;
};

/**
 * Builds the normal Phase 1 editable proposal card — the fallback path when
 * there's no confident, autoRecord-eligible rule match. Split out of
 * resolveAddTransaction to keep that function's cyclomatic complexity under
 * budget; this is pure "assemble params/title/fields/editable" with no
 * additional branching of its own beyond the category guess/blocking check.
 */
async function buildNormalTransactionCard(args: NormalCardArgs): Promise<ResolvedProposal> {
  const { input, amount, date, wallet, note, hadCounterpartyMatch } = args;
  const appCategoryName = input.appCategoryName as string | undefined;

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
    // Not rendered on the card (formatting.ts skipKeys) — read back after
    // approval by execute-proposal.ts's learn-from-correction nudge (ADR-033)
    // to decide whether to offer "remember this" (only when there was no
    // rule at all, not merely "not auto-recorded") and to know which
    // counterparty value to suggest remembering.
    hadCounterpartyMatch,
    counterpartyAccount: input.counterpartyAccount ?? null,
    counterpartyMerchant: input.counterpartyMerchant ?? null,
    counterpartySender: input.counterpartySender ?? null,
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

// Channels whose reply/notification actually reaches Telegram — auto-record
// is scoped to these (Daniel's explicit decision, reconcile pass). The web
// chat channel has no rendering at all for an auto-recorded transaction (no
// NDJSON event, no card UI) — building that is an explicit, separate
// follow-up. `runAgentTurn`'s channel is normalized to "telegram" for BOTH
// the live Telegram webhook AND the /api/ingest "shortcut" entry point
// (see deliver-to-telegram.ts, which always calls runAgentTurn with
// `channel: "telegram"` regardless of its own opts.channel) — so gating on
// "telegram" here already covers both real delivery paths; "web" is the only
// other value this function ever receives.
const AUTO_RECORD_CHANNELS = new Set(["telegram"]);

export async function resolveAddTransaction(
  input: Record<string, unknown>,
  channel = "web",
): Promise<ResolvedProposal> {
  const amount = Number(input.amount);
  const date = (input.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const wallet = (input.wallet as string | undefined) ?? "—";
  const note = input.note as string | undefined;

  const rule = await lookupRuleFromInput(input, amount);

  // Confident, autoRecord-eligible match → the counterparty-rule exception
  // (ADR-033): create the transaction immediately instead of a normal card.
  // The rule's category/wallet OVERRIDE the message's guessed category and
  // stated account — "transfer to account X" is a payment to whatever the
  // rule says, never a self-transfer. Scoped to channels that actually
  // deliver to Telegram (see AUTO_RECORD_CHANNELS) — on "web" this falls
  // through to the normal editable card below, exactly as if no rule had
  // matched, since the web chat UI has no rendering for an auto-recorded
  // notice yet.
  if (
    rule &&
    rule.autoRecord &&
    isConfidentTransaction(amount, date) &&
    AUTO_RECORD_CHANNELS.has(channel)
  ) {
    const result = await autoRecordFromRule({ amount, date, note, rule, channel });
    return { params: {}, title: "", fields: [], autoRecorded: result };
  }

  return buildNormalTransactionCard({
    input,
    amount,
    date,
    wallet,
    note,
    hadCounterpartyMatch: rule != null,
  });
}
