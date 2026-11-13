"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { walletDeleteBlocker } from "@/lib/wallet-settings-display";

// Wallet balances and flags show on Home, Savings & Loans and the ledger's
// wallet filter, not only on the settings screen.
const PATHS = ["/settings/wallets", "/overview", "/loans", "/expenses"] as const;

function revalidateAll() {
  for (const path of PATHS) revalidatePath(path);
}

type Result = { error?: string };

export type WalletInput = {
  name: string;
  color: string | null;
  isSavings: boolean;
  includeInAvailable: boolean;
  /** Make this the account's default wallet. Unsetting isn't offered: pick another wallet instead. */
  makeDefault: boolean;
  /** Only sent when changed: re-saving the same day would move the epoch's time of day. */
  openingBalance?: number;
  openingDate?: Date;
};

/** Prisma's unique-constraint error (@@unique([accountId, name])). */
function duplicateName(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

function walletFields(input: WalletInput) {
  return {
    name: input.name.trim(),
    color: input.color,
    isSavings: input.isSavings,
    // "Available" only means something for a savings wallet (loans.ts sums isSavings && includeInAvailable).
    includeInAvailable: input.isSavings && input.includeInAvailable,
    ...(input.openingBalance !== undefined && { openingBalance: input.openingBalance }),
    ...(input.openingDate !== undefined && { openingDate: input.openingDate }),
  };
}

export async function createWallet(accountId: string, input: WalletInput): Promise<Result> {
  const fields = walletFields(input);
  if (!fields.name) return { error: "Give the wallet a name." };
  try {
    await db.$transaction(async (tx) => {
      const last = await tx.wallet.findFirst({ where: { accountId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
      const wallet = await tx.wallet.create({
        data: {
          accountId,
          ...fields,
          sortOrder: (last?.sortOrder ?? -1) + 1,
          openingBalance: fields.openingBalance ?? 0,
          openingDate: fields.openingDate ?? new Date(),
        },
      });
      if (input.makeDefault) {
        await tx.savingsAccount.update({ where: { id: accountId }, data: { defaultWalletId: wallet.id } });
      }
    });
  } catch (err) {
    if (duplicateName(err)) return { error: "This account already has a wallet with that name." };
    throw err;
  }
  revalidateAll();
  return {};
}

export async function updateWallet(id: string, input: WalletInput): Promise<Result> {
  const fields = walletFields(input);
  if (!fields.name) return { error: "Give the wallet a name." };
  try {
    await db.$transaction(async (tx) => {
      const wallet = await tx.wallet.update({ where: { id }, data: fields });
      if (input.makeDefault) {
        await tx.savingsAccount.update({ where: { id: wallet.accountId }, data: { defaultWalletId: id } });
      }
    });
  } catch (err) {
    if (duplicateName(err)) return { error: "This account already has a wallet with that name." };
    throw err;
  }
  revalidateAll();
  return {};
}

/**
 * Checks the same rules the dialog shows (walletDeleteBlocker) against fresh
 * counts, so a wallet that picked up a transaction since the page loaded
 * still can't go. Returns `{ error }` rather than throwing: thrown messages
 * are hidden from the client in production.
 */
export async function deleteWallet(id: string): Promise<Result> {
  const wallet = await db.wallet.findUnique({
    where: { id },
    select: {
      account: { select: { savingsWalletId: true, defaultWalletId: true, _count: { select: { wallets: true } } } },
      _count: { select: { transactions: true, loans: true, vaultEntriesFunded: true, counterpartyRules: true } },
    },
  });
  if (!wallet) return { error: "This wallet no longer exists." };

  const blocker = walletDeleteBlocker(
    {
      isMain: wallet.account.savingsWalletId === id,
      isDefault: wallet.account.defaultWalletId === id,
      usage: {
        transactions: wallet._count.transactions,
        loans: wallet._count.loans,
        vaultEntries: wallet._count.vaultEntriesFunded,
        rules: wallet._count.counterpartyRules,
      },
    },
    wallet.account._count.wallets,
  );
  if (blocker) return { error: blocker };

  await db.wallet.delete({ where: { id } });
  revalidateAll();
  return {};
}
