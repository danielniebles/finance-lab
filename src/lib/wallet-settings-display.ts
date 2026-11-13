/**
 * Display + guard rules for the Wallets settings screen (/settings/wallets).
 * Pure and client-safe: the page, the dialog and the server action all use
 * the same rules, so the dialog never offers a delete the server refuses.
 */

export type WalletUsage = {
  transactions: number;
  loans: number;
  vaultEntries: number;
  rules: number;
};

export type WalletSettingsRow = {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isSavings: boolean;
  includeInAvailable: boolean;
  openingBalance: number;
  openingDate: Date;
  balance: number;
  /** The account's savingsWalletId: account entries and transfers land here. */
  isMain: boolean;
  /** The account's defaultWalletId: transactions that only name the institution land here. */
  isDefault: boolean;
  usage: WalletUsage;
};

export type WalletSettingsAccount = {
  id: string;
  name: string;
  accountType: "BANK" | "DIGITAL" | "PENSION";
  color: string | null;
  includeInOverviewTotal: boolean;
  balance: number;
  wallets: WalletSettingsRow[];
};

export type WalletRole = "savings" | "available" | "default" | "main";

const ROLE_LABELS: Record<WalletRole, { short: string; long: string; title: string }> = {
  savings: { short: "Savings", long: "Savings", title: "Part of the savings figure on Savings & Loans" },
  available: { short: "Available", long: "Available", title: "Counts toward the available balance" },
  default: {
    short: "Default",
    long: "Default for new transactions",
    title: "Gets transactions that only name the account",
  },
  main: { short: "Main", long: "Main · entries & transfers", title: "Account entries and transfers land here" },
};

export type WalletRoleChip = { role: WalletRole; label: string; title: string };

/**
 * The chips under a wallet's name. A single-wallet account gets the short
 * labels: "Default"/"Main" say little there, since every flow lands in it.
 */
export function walletRoleChips(wallet: WalletSettingsRow, walletCount: number): WalletRoleChip[] {
  const roles: WalletRole[] = [];
  if (wallet.isSavings) roles.push("savings");
  if (wallet.isSavings && wallet.includeInAvailable) roles.push("available");
  if (wallet.isDefault) roles.push("default");
  if (wallet.isMain) roles.push("main");
  return roles.map((role) => ({
    role,
    label: walletCount > 1 ? ROLE_LABELS[role].long : ROLE_LABELS[role].short,
    title: ROLE_LABELS[role].title,
  }));
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function usageParts(usage: WalletUsage): string[] {
  return [
    usage.transactions > 0 ? plural(usage.transactions, "transaction", "transactions") : null,
    usage.loans > 0 ? plural(usage.loans, "loan", "loans") : null,
    usage.vaultEntries > 0 ? plural(usage.vaultEntries, "vault entry", "vault entries") : null,
    usage.rules > 0 ? plural(usage.rules, "rule", "rules") : null,
  ].filter((p): p is string => p !== null);
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** Why this wallet can't be deleted, or null when it can. */
export function walletDeleteBlocker(
  wallet: Pick<WalletSettingsRow, "isMain" | "isDefault" | "usage">,
  walletCount: number,
): string | null {
  if (walletCount <= 1) return "An account needs at least one wallet.";
  if (wallet.isMain) return "Account entries and transfers land in this wallet, so it can't be deleted.";
  if (wallet.isDefault) return "It's the account's default wallet. Make another wallet the default first.";
  const parts = usageParts(wallet.usage);
  if (parts.length > 0) return `It still has ${joinList(parts)}. Move or delete those first.`;
  return null;
}

/** "Bank · 3 wallets", "AFP · not in Home total". */
export function accountSubtitle(account: Pick<WalletSettingsAccount, "accountType" | "includeInOverviewTotal" | "wallets">): string {
  const type = { BANK: "Bank", DIGITAL: "Digital", PENSION: "AFP" }[account.accountType];
  const second = account.includeInOverviewTotal
    ? plural(account.wallets.length, "wallet", "wallets")
    : "not in Home total";
  return `${type} · ${second}`;
}

/** The opening balance as the dialog holds it: digits + sign. */
export function openingBalanceParts(value: number): { digits: string; negative: boolean } {
  const rounded = Math.round(value);
  return { digits: rounded === 0 ? "" : String(Math.abs(rounded)), negative: rounded < 0 };
}

export function openingBalanceFromParts(digits: string, negative: boolean): number {
  const n = digits ? Number(digits) : 0;
  return negative ? -n : n;
}
