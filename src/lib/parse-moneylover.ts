import * as XLSX from "xlsx";

export type RawTransaction = {
  externalId: number;
  date: Date;
  category: string;
  amount: number;
  wallet: string;
  note: string | null;
};

export type ParseResult = {
  transactions: RawTransaction[];
  categories: string[];
  periodStart: Date;
  periodEnd: Date;
  month: number;
  year: number;
};

// Categories to exclude from transaction storage entirely
const IGNORED_CATEGORIES = new Set<string>();

/**
 * Given a transaction date, returns the financial month and year it belongs to.
 * If the day >= startDay, the transaction falls in the *next* calendar month's
 * financial period. E.g. with startDay=25, Feb 25 → financial month March.
 */
export function financialMonthYear(date: Date, startDay: number): { month: number; year: number } {
  const day = date.getDate();
  const calMonth = date.getMonth() + 1; // 1-based
  const calYear = date.getFullYear();

  if (startDay <= 1 || day < startDay) {
    return { month: calMonth, year: calYear };
  }

  // Advance by one month
  if (calMonth === 12) {
    return { month: 1, year: calYear + 1 };
  }
  return { month: calMonth + 1, year: calYear };
}

/** Parses one XLSX row into a RawTransaction, or null if the row should be skipped. */
function parseRow(row: Record<string, unknown>): RawTransaction | null {
  const category = String(row["Category"] ?? "").trim();
  if (!category || IGNORED_CATEGORIES.has(category)) return null;

  const rawDate = row["Date"];
  const date = rawDate instanceof Date ? rawDate : new Date(String(rawDate));
  if (isNaN(date.getTime())) return null;

  const amount = Number(row["Amount"]);
  if (isNaN(amount)) return null;

  return {
    externalId: Number(row["Id"]),
    date,
    category,
    amount,
    wallet: String(row["Wallet"] ?? "").trim(),
    note: row["Note"] ? String(row["Note"]).trim() : null,
  };
}

/**
 * Assigns each transaction to its financial month, then returns the dominant
 * one. With a custom startDay the dominant month is deterministic (all
 * transactions exported for one financial period map to the same financial month).
 */
function dominantFinancialMonth(
  transactions: RawTransaction[],
  startDay: number,
): { month: number; year: number } {
  const monthCounts: Record<string, number> = {};
  for (const t of transactions) {
    const { month, year } = financialMonthYear(t.date, startDay);
    const key = `${year}-${month}`;
    monthCounts[key] = (monthCounts[key] ?? 0) + 1;
  }
  const dominantKey = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0][0];
  const [year, month] = dominantKey.split("-").map(Number);
  return { month, year };
}

export function parseMoneyLoverBuffer(buffer: Buffer, startDay = 1): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // raw: true preserves Date objects produced by cellDates: true
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
  });

  const transactions = rows
    .map(parseRow)
    .filter((t): t is RawTransaction => t !== null);

  if (transactions.length === 0) {
    throw new Error("No valid transactions found in the file.");
  }

  const dates = transactions.map((t) => t.date.getTime());
  const periodStart = new Date(Math.min(...dates));
  const periodEnd = new Date(Math.max(...dates));

  const { month, year } = dominantFinancialMonth(transactions, startDay);
  const categories = [...new Set(transactions.map((t) => t.category))];

  return { transactions, categories, periodStart, periodEnd, month, year };
}
