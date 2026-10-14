import { db } from "@/lib/db";
import {
  compareCategorySpend,
  currentPeriodDay,
  decomposeWalletChange,
  periodToDateWindow,
  shiftMonth,
  summarizeWindow,
  type CategorizedFlow,
  type CategoryDelta,
  type PeriodWindow,
  type WalletChange,
  type WalletWindow,
  type WindowTotals,
} from "@/lib/period-comparison-utils";
import { buildWalletBalances, loadWalletBalanceSources, type WalletBalanceSources } from "@/lib/queries/wallets";

// Periods before the previous one averaged into each category's baseline.
const BASELINE_PERIODS = 3;
const MAX_DAY = 31;

export type PeriodToDateRequest = { month?: number; year?: number; day?: number; wallet?: string };

type WindowSummary = { month: number; year: number; from: Date; until: Date; totals: WindowTotals };

export type PeriodToDateComparison = {
  day: number;
  current: WindowSummary;
  previous: WindowSummary;
  baselinePeriods: { month: number; year: number }[];
  categories: CategoryDelta[];
  wallet?: {
    name: string;
    account: string;
    current: Omit<WalletWindow, "totals">;
    previous: Omit<WalletWindow, "totals"> | null;
    change: WalletChange | null;
  };
};

function financialStartDay(): number {
  return parseInt(process.env.FINANCIAL_MONTH_START_DAY ?? "1", 10);
}

// Omitted month/year → today's period. Omitted day → today's day of the
// period when comparing the current one, else the whole period.
function resolveTarget(req: PeriodToDateRequest, now: Date, startDay: number) {
  const today = currentPeriodDay(now, startDay);
  const month = req.month ?? today.month;
  const year = req.year ?? today.year;
  const isCurrent = month === today.month && year === today.year;
  const day = req.day ?? (isCurrent ? today.day : MAX_DAY);
  return { month, year, day: Math.min(Math.max(Math.trunc(day), 1), MAX_DAY) };
}

type WalletRef = { id: string; name: string; account: string };

/** Exact (case-insensitive) name first, else a unique partial match. */
function findWallet(sources: WalletBalanceSources, query: string): WalletRef | { error: string } {
  const all = sources.accounts.flatMap((a) => a.wallets.map((w) => ({ id: w.id, name: w.name, account: a.name })));
  const q = query.trim().toLowerCase();
  const exact = all.filter((w) => w.name.toLowerCase() === q);
  const matches = exact.length ? exact : all.filter((w) => `${w.account} ${w.name}`.toLowerCase().includes(q));
  if (matches.length === 1) return matches[0];
  const names = all.map((w) => `${w.account} / ${w.name}`).join(", ");
  return { error: `${matches.length ? "Ambiguous" : "Unknown"} wallet "${query}". Wallets: ${names}` };
}

async function loadFlows(from: Date, until: Date, walletId?: string): Promise<CategorizedFlow[]> {
  const category = { select: { name: true, isTransfer: true } };
  const rows = await db.transaction.findMany({
    where: { date: { gte: from, lt: until }, ...(walletId ? { walletId } : {}) },
    select: {
      date: true,
      amount: true,
      isTransfer: true,
      appCategory: category,
      moneyLoverCategory: { select: { mapping: { select: { appCategory: category } } } },
    },
  });
  // ADR-030: a direct appCategory wins, else the MoneyLover mapping.
  return rows.map((r) => {
    const cat = r.appCategory ?? r.moneyLoverCategory?.mapping?.appCategory ?? null;
    return { date: r.date, amount: r.amount, category: cat?.name ?? null, isTransfer: r.isTransfer || !!cat?.isTransfer };
  });
}

function balanceAt(sources: WalletBalanceSources, walletId: string, asOf: Date): number | null {
  const wallets = buildWalletBalances(sources, asOf).accounts.flatMap((a) => a.wallets);
  return wallets.find((w) => w.id === walletId)?.balance ?? null;
}

function walletWindow(sources: WalletBalanceSources, walletId: string, w: PeriodWindow, totals: WindowTotals): WalletWindow | null {
  const startBalance = balanceAt(sources, walletId, w.start);
  const endBalance = balanceAt(sources, walletId, w.end);
  if (startBalance === null || endBalance === null) return null;
  return { startBalance, endBalance, totals };
}

// Whole pesos: float sums otherwise surface as 410079.59 or -9.3e-10 to the model.
function roundPesos<T>(value: T): T {
  if (typeof value === "number") return Math.round(value) as T;
  if (Array.isArray(value)) return value.map(roundPesos) as T;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, roundPesos(v)])) as T;
  }
  return value;
}

type WalletComparison = NonNullable<PeriodToDateComparison["wallet"]>;

function walletComparison(
  sources: WalletBalanceSources,
  wallet: WalletRef,
  [curWindow, prevWindow]: [PeriodWindow, PeriodWindow],
  [curTotals, prevTotals]: [WindowTotals, WindowTotals],
): WalletComparison | { error: string } {
  const cur = walletWindow(sources, wallet.id, curWindow, curTotals);
  const prev = walletWindow(sources, wallet.id, prevWindow, prevTotals);
  if (!cur) return { error: `Wallet "${wallet.name}" has no balance history for this period.` };
  const strip = ({ startBalance, endBalance }: WalletWindow) => ({ startBalance, endBalance });
  return {
    name: wallet.name,
    account: wallet.account,
    current: strip(cur),
    previous: prev ? strip(prev) : null,
    change: prev ? decomposeWalletChange(cur, prev) : null,
  };
}

function summary(w: PeriodWindow, totals: WindowTotals): WindowSummary {
  return { month: w.month, year: w.year, from: w.start, until: w.end, totals };
}

/**
 * The first `day` days of a financial period against the same days of the
 * previous period (plus a per-category average of the {@link BASELINE_PERIODS}
 * before that). With `wallet`, everything is scoped to that wallet and its
 * balance difference is decomposed into carryover / income / spend /
 * transfers / other flows — the clean way to read "how much did I have at
 * this point last month", since a one-off income on another wallet can't
 * mask the comparison.
 */
export async function comparePeriodToDate(
  req: PeriodToDateRequest,
  now = new Date(),
): Promise<PeriodToDateComparison | { error: string }> {
  const startDay = financialStartDay();
  const { month, year, day } = resolveTarget(req, now, startDay);
  const windows = Array.from({ length: BASELINE_PERIODS + 2 }, (_, i) => {
    const p = shiftMonth(month, year, -i);
    return periodToDateWindow(p.month, p.year, day, startDay);
  });

  const sources = req.wallet ? await loadWalletBalanceSources() : null;
  const wallet = sources && req.wallet ? findWallet(sources, req.wallet) : null;
  if (wallet && "error" in wallet) return wallet;

  const flows = await loadFlows(windows[windows.length - 1].start, windows[0].end, wallet?.id);
  const [current, previous, ...baseline] = windows.map((w) => summarizeWindow(flows, w));

  const result: PeriodToDateComparison = {
    day,
    current: summary(windows[0], current),
    previous: summary(windows[1], previous),
    baselinePeriods: windows.slice(2).map((w) => ({ month: w.month, year: w.year })),
    categories: compareCategorySpend(current, previous, baseline),
  };
  if (sources && wallet) {
    const scoped = walletComparison(sources, wallet, [windows[0], windows[1]], [current, previous]);
    if ("error" in scoped) return scoped;
    result.wallet = scoped;
  }
  return roundPesos(result);
}
