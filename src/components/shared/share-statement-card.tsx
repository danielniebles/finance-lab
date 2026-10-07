import { Money } from "@/components/ds";
import { statementGreeting, type ShareLine, type ShareStatement } from "@/lib/share-statement";

const LABEL = "text-xs tracking-wide text-muted-foreground uppercase";

function Lines({ lines, heading, muted = false }: { lines: ShareLine[]; heading?: string; muted?: boolean }) {
  return (
    <div className="mt-4">
      {heading && <p className={LABEL}>{heading}</p>}
      <ul className="flex flex-col">
        {lines.map((l, i) => (
          <li key={i} className="flex items-start justify-between gap-4 border-t border-border/40 py-2.5 first:border-t-0">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={muted ? "text-sm" : "text-sm font-medium"}>{l.label}</span>
              {l.detail && <span className="text-xs text-muted-foreground">{l.detail}</span>}
            </span>
            <Money value={l.amount} className="pt-0.5 text-sm" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The image someone receives: greeting, one row per item, the total, an
 * optional secondary list and note. Fixed width so the PNG looks the same
 * from any screen.
 */
export function ShareStatementCard({ statement, ref }: { statement: ShareStatement; ref?: React.Ref<HTMLDivElement> }) {
  const s = statement;
  return (
    <div ref={ref} className="w-full max-w-90 rounded-2xl border border-border/60 bg-card p-5 text-card-foreground">
      <p className="font-heading text-lg font-semibold">{statementGreeting(s)}</p>
      {s.recipient && <p className="text-sm text-muted-foreground">{s.subtitle}</p>}

      <Lines lines={s.lines} heading={s.linesHeading} />

      <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-border/60 pt-3">
        <span className={LABEL}>{s.totalLabel}</span>
        <Money value={s.total} className="text-xl font-semibold" />
      </div>

      {s.extra && <Lines lines={s.extra.lines} heading={s.extra.heading} muted />}

      {s.note && <p className="mt-4 rounded-lg bg-muted/50 px-3 py-2 text-sm whitespace-pre-line">{s.note}</p>}
      <p className="mt-4 text-right text-xs text-muted-foreground">{s.issuedOn}</p>
    </div>
  );
}
