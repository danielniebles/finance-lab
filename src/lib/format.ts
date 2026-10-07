// UTC-based (not local getters) so this round-trips correctly regardless of
// the browser's timezone — mirrors use-loan-form.helpers.ts's toDateInput.
// Local getters would misread a UTC-midnight-anchored date (e.g. a
// MoneyLover-imported row) as the day before in any negative-UTC-offset
// timezone (like Bogotá), which then gets silently re-saved as the wrong day.
export function dateInputValue(date: Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * A stored date (loan, payment, account entry) as es-CO text, read as a UTC
 * calendar day for the same reason as dateInputValue. Also keeps the server
 * (UTC) and the browser (Bogotá) rendering the same text, so no hydration
 * mismatch.
 */
export function formatStoredDate(date: Date | string, options: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString("es-CO", { ...options, timeZone: "UTC" });
}

export function formatCOP(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatShort(amount: number): string {
  if (amount >= 1_000_000) return `$ ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$ ${(amount / 1_000).toFixed(1)}k`;
  return formatCOP(amount);
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
