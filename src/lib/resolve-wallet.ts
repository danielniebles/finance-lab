/**
 * Resolves a legacy wallet STRING label (e.g. "Bancolombia", "savings",
 * "Nequi") to a concrete Wallet id (ADR-036/037, HANDOFF §3b — the write-path
 * resolver rule).
 *
 * Rule: match the label against a Wallet's own name first (case-insensitive
 * — a real partition name, e.g. "savings"). If that misses — including when
 * the label just names an institution with multiple partitions (e.g.
 * "Bancolombia") — fall back to that SavingsAccount's `defaultWalletId` (the
 * ambient/debit-daily wallet). If the label matches NEITHER a wallet nor an
 * account at all (a bot guess like "Debit" or "Debit Card" that isn't any
 * real name), fall back further to the primary account's (Bancolombia)
 * defaultWalletId — the overwhelming majority of unresolved labels are its
 * day-to-day spending, and a visible-but-possibly-wrong wallet beats a null
 * walletId, which is silently invisible to every wallet-scoped balance/view.
 * Returns null only if even that primary account/wallet doesn't exist.
 *
 * `buildWalletResolver()` prefetches every Wallet/SavingsAccount name ONCE
 * and returns a synchronous lookup function, so a caller resolving many rows
 * (import, batch card ingestion) does one query instead of one per row.
 * Standalone (not inside actions/ or queries/) because it's shared by every
 * write path that creates a Transaction — mirrors normalize-match-value.ts's
 * precedent for a resolver shared across layers.
 */

import { db } from "@/lib/db";

export type WalletResolver = (label: string) => string | null;

// The account whose defaultWalletId backstops a completely unrecognized
// label — see the module doc above for why Bancolombia specifically.
const FALLBACK_ACCOUNT_NAME = "bancolombia";

export async function buildWalletResolver(): Promise<WalletResolver> {
  const [wallets, accounts] = await Promise.all([
    db.wallet.findMany({ select: { id: true, name: true } }),
    db.savingsAccount.findMany({ select: { name: true, defaultWalletId: true } }),
  ]);

  const walletIdByName = new Map(wallets.map((w) => [w.name.toLowerCase(), w.id]));
  const defaultWalletIdByAccountName = new Map(
    accounts.map((a) => [a.name.toLowerCase(), a.defaultWalletId]),
  );
  const fallbackWalletId = defaultWalletIdByAccountName.get(FALLBACK_ACCOUNT_NAME) ?? null;

  return (label: string): string | null => {
    const key = label.toLowerCase();
    return walletIdByName.get(key) ?? defaultWalletIdByAccountName.get(key) ?? fallbackWalletId;
  };
}

/** Convenience one-shot resolver for a single label (a fresh prefetch per call). */
export async function resolveWalletId(label: string): Promise<string | null> {
  const resolver = await buildWalletResolver();
  return resolver(label);
}
