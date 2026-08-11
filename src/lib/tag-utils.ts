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
