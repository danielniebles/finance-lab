/**
 * Resolves a legacy wallet STRING label (e.g. "Bancolombia", "savings",
 * "Nequi") to a concrete Wallet id (ADR-036/037, HANDOFF §3b — the write-path
 * resolver rule).
 *
 * Rule: match the label against a Wallet's own name first (case-insensitive
 * — a real partition name, e.g. "savings"). If that misses — including when
 * the label just names an institution with multiple partitions (e.g.
 * "Bancolombia") or matches no wallet/account at all — fall back to that
 * SavingsAccount's `defaultWalletId` (the ambient/debit-daily wallet).
 * Returns null when neither matches anything known.
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

export async function buildWalletResolver(): Promise<WalletResolver> {
  const [wallets, accounts] = await Promise.all([
    db.wallet.findMany({ select: { id: true, name: true } }),
    db.savingsAccount.findMany({ select: { name: true, defaultWalletId: true } }),
  ]);

  const walletIdByName = new Map(wallets.map((w) => [w.name.toLowerCase(), w.id]));
  const defaultWalletIdByAccountName = new Map(
    accounts.map((a) => [a.name.toLowerCase(), a.defaultWalletId]),
  );

  return (label: string): string | null => {
    const key = label.toLowerCase();
    return walletIdByName.get(key) ?? defaultWalletIdByAccountName.get(key) ?? null;
  };
}

/** Convenience one-shot resolver for a single label (a fresh prefetch per call). */
export async function resolveWalletId(label: string): Promise<string | null> {
  const resolver = await buildWalletResolver();
  return resolver(label);
}
