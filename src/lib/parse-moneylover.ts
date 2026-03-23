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

const IGNORED_CATEGORIES = new Set(["Salary"]);

export function parseMoneyLoverBuffer(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    dateNF: "yyyy-mm-dd",
  });

  const transactions: RawTransaction[] = [];

  for (const row of rows) {
    const category = String(row["Category"] ?? "").trim();
    if (!category || IGNORED_CATEGORIES.has(category)) continue;

    const rawDate = row["Date"];
    const date =
      rawDate instanceof Date ? rawDate : new Date(String(rawDate));

    const amount = Number(row["Amount"]);
    if (isNaN(amount)) continue;

    transactions.push({
      externalId: Number(row["Id"]),
      date,
      category,
      amount,
      wallet: String(row["Wallet"] ?? "").trim(),
      note: row["Note"] ? String(row["Note"]).trim() : null,
    });
  }

  if (transactions.length === 0) {
    throw new Error("No valid transactions found in the file.");
  }

  const dates = transactions.map((t) => t.date.getTime());
  const periodStart = new Date(Math.min(...dates));
  const periodEnd = new Date(Math.max(...dates));

  // Use the month/year of the majority of transactions (the target month)
  const monthCounts: Record<string, number> = {};
  for (const t of transactions) {
    const key = `${t.date.getFullYear()}-${t.date.getMonth() + 1}`;
    monthCounts[key] = (monthCounts[key] ?? 0) + 1;
  }
  const dominantKey = Object.entries(monthCounts).sort((a, b) => b[1] - a[1])[0][0];
  const [year, month] = dominantKey.split("-").map(Number);

  const categories = [...new Set(transactions.map((t) => t.category))];

  return { transactions, categories, periodStart, periodEnd, month, year };
}
