// Pure helpers behind the design-system form controls (components/ds/form).
// Client-safe, no DB.

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Keeps digits only and drops leading zeros: "$ 1.200.000" → "1200000". */
export function digitsOnly(input: string, maxLength = 13): string {
  return input.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, maxLength);
}

/** "1200000" → "1.200.000" (es-CO thousands separator). Empty stays empty. */
export function formatThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Number → the digit string a MoneyInput holds ("" for empty/NaN/≤0 not wanted). */
export function amountToDigits(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return digitsOnly(String(Math.round(Math.abs(value))));
}

/** "YYYY-MM-DD" of a date in LOCAL time (toISOString is UTC: wrong after 7pm in Bogotá). */
export function localISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses "YYYY-MM-DD" as a local date (noon, so DST/UTC shifts never change the day). */
export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function shiftISODate(iso: string, days: number): string {
  const d = parseISODate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return localISODate(d);
}

/**
 * Button label for a date field: "Today, Oct 6" / "Yesterday, Oct 5" /
 * "Oct 6" this year / "Mar 12, 2027" otherwise. Same format in every
 * browser, unlike the native date input (which follows the OS locale).
 */
export function formatDateLabel(iso: string, now: Date = new Date()): string {
  const d = parseISODate(iso);
  if (!d) return "";
  const today = localISODate(now);
  const base = `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  if (iso === today) return `Today, ${base}`;
  if (iso === shiftISODate(today, -1)) return `Yesterday, ${base}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}
