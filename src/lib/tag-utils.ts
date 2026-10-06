// Pure, client-safe (no Prisma imports) — mirrors installment-utils.ts's
// split between math/parsing helpers and DB-touching code.

// Splits/trims/dedupes a comma-separated tag draft, normalized the same way
// setTransactionTags does server-side (trim + lowercase) so a round-trip
// through the form always matches what's actually stored.
export function parseTagNames(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const name = part.trim().toLowerCase();
    if (name) seen.add(name);
  }
  return [...seen];
}

/**
 * The tag chip input keeps its whole state in the same comma-separated
 * string the forms already store: everything before the last comma is
 * committed chips, the rest is what's being typed. So a submit with
 * text still in the box keeps that tag too (parseTagNames reads it).
 */
export function splitTagDraft(raw: string): { tags: string[]; draft: string } {
  const lastComma = raw.lastIndexOf(",");
  if (lastComma === -1) return { tags: [], draft: raw };
  return { tags: parseTagNames(raw.slice(0, lastComma)), draft: raw.slice(lastComma + 1).trimStart() };
}

export function joinTagDraft(tags: string[], draft: string): string {
  return tags.length === 0 ? draft : `${tags.join(", ")}, ${draft}`;
}

/** Existing tag names matching what's typed, excluding ones already added. */
export function tagSuggestions(all: string[], tags: string[], draft: string, limit = 5): string[] {
  const q = draft.trim().toLowerCase();
  if (!q) return [];
  return all.filter((n) => n.toLowerCase().startsWith(q) && !tags.includes(n.toLowerCase())).slice(0, limit);
}
