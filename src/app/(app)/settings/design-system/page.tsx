import { notFound } from "next/navigation";
import { Car, Gift, PiggyBank, Wallet } from "lucide-react";
import { ListRow, Meter, Money, SectionHeader, StatCard, StatusChip } from "@/components/ds";
import { SAVINGS_RATE_TARGET, TONE_CLASSES, type Tone } from "@/lib/status";
import { cn } from "@/lib/utils";

// Living reference for the design system: every token and ds/ component in
// every state. Toggle light/dark from the sidebar (and THEME_FAMILY=signal
// for the Signal skin) to check a change across all four themes.
// Dev-only — it ships no user data and isn't linked from the nav.

const TONES: Tone[] = ["positive", "caution", "danger", "unplanned", "info", "neutral"];

const SURFACES = [
  { name: "background", className: "bg-background" },
  { name: "card", className: "bg-card" },
  { name: "muted", className: "bg-muted" },
  { name: "popover", className: "bg-popover" },
  { name: "meter-track", className: "bg-meter-track" },
];

const CHARTS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-chart-7",
  "bg-chart-8",
];

function Swatch({ className, name }: { className: string; name: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("h-12 rounded-lg ring-1 ring-foreground/10", className)} />
      <span className="font-mono text-xs text-muted-foreground">{name}</span>
    </div>
  );
}

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Design system</h1>
        <p className="text-sm text-muted-foreground">
          Tokens from globals.css and components from components/ds. See DESIGN.md §7.
        </p>
      </div>

      <section className="space-y-4">
        <SectionHeader title="Surfaces" />
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
          {SURFACES.map((s) => (
            <Swatch key={s.name} name={s.name} className={s.className} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Status tones" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {TONES.map((tone) => (
            <div key={tone} className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">{tone}</span>
                <StatusChip tone={tone}>Chip</StatusChip>
              </div>
              <Money value={1_613_400} tone={tone} className="text-lg font-semibold" />
              <Meter label={`${tone} meter`} value={62} tone={tone} />
              <div className={cn("h-2 rounded-full", TONE_CLASSES[tone].fill)} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Chart palette" />
        <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
          {CHARTS.map((c, i) => (
            <Swatch key={c} name={`chart-${i + 1}`} className={c} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Money" />
        <div className="flex flex-wrap items-baseline gap-6 rounded-xl border border-border/60 bg-card p-4">
          <Money value={7_063_128} className="text-3xl font-semibold" />
          <Money value={-14_380_899} tone="danger" />
          <Money value={14_765_038} signed tone="positive" />
          <Money value={14_380_899} compact />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Stat cards" />
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Income" value={<Money value={14_765_038} />} />
          <StatCard label="Savings rate" value="2.6%" tone="danger" sub={<Money value={384_139} />} />
          <StatCard label="Variable burn" value="74.0%" tone="positive" sub="of variable budget" />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Meter with target" />
        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Savings rate · target {SAVINGS_RATE_TARGET}%</span>
            <span className="font-mono font-semibold text-destructive">2.6%</span>
          </div>
          <Meter
            label="Savings rate"
            value={2.6}
            max={SAVINGS_RATE_TARGET * 2}
            target={SAVINGS_RATE_TARGET}
            tone="danger"
          />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="List rows" href="/vaults" linkLabel="Vaults" />
        <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card px-4">
          <ListRow
            icon={Car}
            iconTone="info"
            title="Car expenses"
            subtitle="Mandatory"
            trailing={
              <>
                <StatusChip tone="caution">Underfunded</StatusChip>
                <Money value={63_400} />
              </>
            }
          />
          <ListRow
            icon={Gift}
            iconTone="unplanned"
            title="December"
            subtitle="Discretionary"
            trailing={
              <>
                <StatusChip tone="danger">Overdue</StatusChip>
                <Money value={475_000} />
              </>
            }
          />
          <ListRow
            icon={PiggyBank}
            iconTone="positive"
            title="Emergency fund"
            subtitle="Discretionary"
            trailing={<StatusChip tone="positive">Met</StatusChip>}
          />
          <ListRow icon={Wallet} title="Neutral icon tile" subtitle="No status" />
        </div>
      </section>
    </div>
  );
}
