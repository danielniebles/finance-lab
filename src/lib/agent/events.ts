// Agent event log — the system's own record of what actually happened in a
// turn, kept strictly separate from what the model SAID happened.
//
// ─── Why this exists ─────────────────────────────────────────────────────────
// `ChatMessage` is the agent's only memory of past turns, and it used to be a
// lossy, role-mislabelled rendering of them:
//
//   what really happened          what history said next turn
//   ────────────────────          ───────────────────────────
//   model emitted a tool_use  →   nothing (blocks dropped, only prose survives)
//   PendingProposal created   →   "[Proposed: … — awaiting your approval]",
//                                 appended by the system but stored as though
//                                 the MODEL had written it
//   system emitted the nudge  →   an "assistant" row, indistinguishable from
//                                 the model's own words
//   user approved / dismissed →   nothing at all, never persisted
//
// Replayed as `role: "assistant"`, all of that reads back to the model as its
// own speech — while the tool calls that actually caused it are exactly what
// got stripped. The in-context lesson became "a bank notification is answered
// with this prose", with no example showing a tool call. Three production
// incidents followed the same shape:
//
//   2026-07-17  5 identical notifications matched an autoRecord rule; only 2
//               wrote a Transaction. The other 3 got a confident auto-record
//               confirmation with zero tool calls.
//   2026-09-01  a DRAFTED card carried a model-paraphrased "💡 Want me to
//               remember this?" — system-only text, read back as its own.
//   2026-09-02  the next two UBER*RIDES notifications produced no tool call at
//               all. Confirmed by latency independently of any regex: the
//               successful turn took 11s (model → tool_use → resolver DB
//               round-trips → model), the two failures 2.4s and 5s — one model
//               call returning text and stopping. Zero PendingProposal rows.
//
// It does not take a saturated history window: only 6 ChatMessage rows existed
// across those two days. One polluted exemplar in the immediately preceding
// turn was enough.
//
// ─── The contract ────────────────────────────────────────────────────────────
// System-authored records are written with `role: "event"` and replayed to the
// model as observations (folded into the user turn), never as its own speech.
// An action exists only if an event line records it — prompt.ts states this to
// the model directly, which is what makes "prose alone → no event line
// follows" learnable in-context instead of something a regex has to catch
// after the fact.
//
// `role` is a plain String column, so this needs no migration. Pre-existing
// rows stay "assistant" and simply age out of the 20-message window.

import { saveMessage } from "@/lib/actions/chat";

export type ChatRole = "user" | "assistant" | "event";

export const EVENT_ROLE = "event";

/** Deliberately unlike prose, and not something the model can plausibly emit. */
export const EVENT_PREFIX = "⟦event⟧";

export type AgentEventName =
  | "proposal_created"
  | "proposal_approved"
  | "proposal_dismissed"
  | "auto_recorded"
  | "rule_offer"
  | "unbacked_claim";

export type EventFields = Record<string, string | number | boolean | null | undefined>;

// `unbacked_claim` quotes the model's own phantom prose verbatim, for the
// audit trail. It must NEVER be replayed into the model's context: feeding
// action-claiming text back as history is precisely the defect this log
// exists to fix. Every other event is safe (and useful) to replay.
const NON_REPLAYED_EVENTS: AgentEventName[] = ["unbacked_claim"];

function formatEventValue(value: string | number | boolean): string {
  const str = String(value);
  // JSON.stringify also escapes newlines, keeping every event on one line.
  return /[\s"]/.test(str) ? JSON.stringify(str) : str;
}

export function formatEvent(name: AgentEventName, fields: EventFields = {}): string {
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${formatEventValue(value as string | number | boolean)}`);
  return [`${EVENT_PREFIX} ${name}`, ...parts].join(" ");
}

/** True for an event row that is safe to replay into the model's history. */
export function isReplayableEventContent(content: string): boolean {
  return !NON_REPLAYED_EVENTS.some((name) => content.startsWith(`${EVENT_PREFIX} ${name}`));
}

/**
 * Appends one event row to the shared history.
 *
 * Never throws: by the time an event is written the underlying action has
 * already happened, so a failed log write must not surface to the user as a
 * failed approval. It is logged loudly instead — a silently missing
 * `proposal_created` row is exactly the blindness this module removes.
 */
export async function logEvent(
  name: AgentEventName,
  fields: EventFields = {},
  channel?: "web" | "telegram" | "shortcut",
): Promise<void> {
  try {
    await saveMessage(EVENT_ROLE, formatEvent(name, fields), channel);
  } catch (err) {
    console.error("[agent-events] failed to persist event:", { name, fields, err });
  }
}
