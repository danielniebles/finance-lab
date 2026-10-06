import { TONE_CLASSES } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * One form field: label (+ muted "optional"), the control, then a hint or an
 * error. Every form in the app uses it, so labels look the same everywhere.
 *
 * It also sizes the shadcn controls inside it (inputs, select triggers) to
 * the form height and full width, so a field never renders a tiny `w-fit`
 * dropdown next to a full-width input.
 */
export function Field({
  label,
  htmlFor,
  optional = false,
  hint,
  error,
  aside,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  optional?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Right side of the label row (e.g. a compact SegmentedControl). */
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const LabelTag = htmlFor ? "label" : "span";
  return (
    <div
      data-slot="field"
      className={cn(
        "flex min-w-0 scroll-my-4 flex-col gap-1.5",
        "[&_[data-slot=input]]:min-h-10 [&_[data-slot=select-trigger]]:min-h-10 [&_[data-slot=select-trigger]]:w-full",
        className,
      )}
    >
      <div className="flex min-h-5 items-center justify-between gap-3">
        <LabelTag htmlFor={htmlFor} className="flex items-baseline gap-1.5 text-sm font-medium text-foreground">
          {label}
          {optional && <span className="text-xs font-normal text-muted-foreground">optional</span>}
        </LabelTag>
        {aside}
      </div>
      {children}
      {error ? (
        <p role="alert" className={cn("text-xs", TONE_CLASSES.danger.text)}>
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** Small uppercase heading that groups fields inside a form ("Optional links"). */
export function FieldGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-t border-border/60 pt-4 font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

/** Read-only computed value inside a form ("Monthly payment  $ 350.000"). */
export function FormReadout({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg bg-muted px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{children}</span>
    </div>
  );
}
