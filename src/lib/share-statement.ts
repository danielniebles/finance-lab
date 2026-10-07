import { formatCOP } from "@/lib/format";
import type { DueThisMonth } from "@/lib/queries/installments";
import type { DebtorWithLoans } from "@/lib/queries/loans";

// A short "what you owe me" summary to send someone, as an image card or as
// plain text. The recipient reads Spanish, so the copy here is Spanish.

export type ShareLine = { label: string; detail: string; amount: number };

export type ShareSection = { heading: string; lines: ShareLine[] };

export type ShareStatement = {
  recipient: string;
  title: string;
  /** Under the greeting, and the intro of the text message. */
  subtitle: string;
  lines: ShareLine[];
  linesHeading?: string;
  totalLabel: string;
  total: number;
  /** A secondary list after the total (e.g. recent payments). */
  extra?: ShareSection;
  note: string;
  issuedOn: string;
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const shortDate = (d: Date) => `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
const fullDate = (d: Date) => `${shortDate(d)} ${d.getFullYear()}`;
/** "19 mar", plus the year when it isn't this year: "19 mar 2025". */
const dateIn = (d: Date, today: Date) => (d.getFullYear() === today.getFullYear() ? shortDate(d) : fullDate(d));
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** "vence 10 oct" / "venció 5 oct" (relative to today); "" with no due day. */
export function dueText(dueDay: number | null, month: number, year: number, today: Date = new Date()): string {
  if (dueDay === null) return "";
  const due = new Date(year, month - 1, dueDay);
  return `${due < startOfDay(today) ? "venció" : "vence"} ${shortDate(due)}`;
}

/** The debtor's name when every selected slot is linked to the same one, else "". */
export function suggestedRecipient(items: DueThisMonth[]): string {
  const names = new Set(items.map((d) => d.installment.debtorName));
  const [only] = names;
  return names.size === 1 && only ? only : "";
}

export function installmentStatement(
  items: DueThisMonth[],
  opts: {
    recipient: string;
    note: string;
    month: number;
    year: number;
    dueDayOf: (d: DueThisMonth) => number | null;
    today?: Date;
  },
): ShareStatement {
  const today = opts.today ?? new Date();
  const lines = items.map((d) => {
    const due = dueText(opts.dueDayOf(d), opts.month, opts.year, today);
    const slot = `Cuota ${d.installmentNum} de ${d.installment.numInstallments}`;
    return { label: d.installment.description, detail: due ? `${slot} · ${due}` : slot, amount: d.amount };
  });
  const title = `Cuotas ${MESES[opts.month - 1]} ${opts.year}`;
  return {
    recipient: opts.recipient.trim(),
    title,
    subtitle: `Resumen de ${title.toLowerCase()}`,
    lines,
    totalLabel: "Total",
    total: items.reduce((s, d) => s + d.amount, 0),
    note: opts.note.trim(),
    issuedOn: fullDate(today),
  };
}

export const RECENT_PAYMENTS = 3;

/**
 * A stored loan/payment date as a local calendar day. Read in UTC, like
 * format.ts's dateInputValue: older rows sit at UTC midnight, which local
 * getters would show as the day before in Bogotá.
 */
const storedDay = (v: Date) => {
  const d = new Date(v);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

const loanLabel = (notes: string | null) => notes?.split("\n")[0].trim() || "Préstamo";

/**
 * What a debtor owes right now: each active loan (oldest first) with what's
 * left on it, the balance, and their last few payments as proof they counted.
 */
export function debtorStatement(
  debtor: Pick<DebtorWithLoans, "loans" | "totalOwed">,
  opts: { recipient: string; note: string; today?: Date },
): ShareStatement {
  const today = opts.today ?? new Date();
  const active = debtor.loans
    .filter((l) => l.isActive)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const lines = active.map((l) => {
    const parts = [dateIn(storedDay(l.date), today)];
    if (l.paid > 0) parts.push(`abonado ${formatCOP(l.paid)} de ${formatCOP(l.amount)}`);
    if (l.expectedBy) {
      const by = storedDay(l.expectedBy);
      parts.push(`${by < startOfDay(today) ? "venció" : "acordado"} ${dateIn(by, today)}`);
    }
    return { label: loanLabel(l.notes), detail: parts.join(" · "), amount: l.remaining };
  });
  const payments = debtor.loans
    .flatMap((l) => l.payments.map((p) => ({ date: storedDay(p.date), amount: p.amount, loan: loanLabel(l.notes) })))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, RECENT_PAYMENTS)
    .map((p) => ({ label: dateIn(p.date, today), detail: p.loan, amount: p.amount }));
  return {
    recipient: opts.recipient.trim(),
    title: "Estado de cuenta",
    subtitle: `Estado de cuenta al ${fullDate(today)}`,
    lines,
    linesHeading: "Préstamos activos",
    totalLabel: "Saldo pendiente",
    total: debtor.totalOwed,
    extra: payments.length > 0 ? { heading: "Últimos abonos", lines: payments } : undefined,
    note: opts.note.trim(),
    issuedOn: fullDate(today),
  };
}

export const statementGreeting = (s: ShareStatement) => (s.recipient ? `Hola ${s.recipient}` : s.title);

/** The same statement as a chat message. */
const bullets = (lines: ShareLine[]) =>
  lines.map((l) => `• ${l.label}${l.detail ? ` (${l.detail.toLowerCase()})` : ""}: ${formatCOP(l.amount)}`);

export function statementText(s: ShareStatement): string {
  const head = s.recipient ? `Hola ${s.recipient}, ${s.subtitle.toLowerCase()}:` : `${s.subtitle}:`;
  const out = [head, ""];
  if (s.linesHeading) out.push(`${s.linesHeading}:`);
  out.push(...bullets(s.lines), "", `*${s.totalLabel}: ${formatCOP(s.total)}*`);
  if (s.extra) out.push("", `${s.extra.heading}:`, ...bullets(s.extra.lines));
  if (s.note) out.push("", s.note);
  return out.join("\n");
}
