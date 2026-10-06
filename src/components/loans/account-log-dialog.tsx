"use client";

import { useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorDot, FormDialog, FormFooter, Money, StatusChip } from "@/components/ds";
import { RowDeleteButton } from "@/components/shared/row-delete-button";
import { deleteEntry } from "@/lib/actions/loans";
import type { Tone } from "@/lib/status";
import type { AccountWithBalance } from "@/lib/queries/loans";

type LogRow = {
  id: string;
  kind: "entry" | "vault";
  chip: { tone: Tone; label: string };
  /** Signed effect on the account balance. */
  amount: number;
  date: Date;
  text: string;
};

/** Account entries and vault movements, newest first, signed as they hit the balance. */
export function buildLogRows(account: AccountWithBalance): LogRow[] {
  const entries: LogRow[] = account.entries.map((e) => ({
    id: e.id,
    kind: "entry",
    chip: e.type === "INITIAL" ? { tone: "info", label: "Opening" } : { tone: "neutral", label: "Adjustment" },
    amount: e.amount,
    date: e.date,
    text: e.notes ?? "",
  }));
  // A contribution to a vault takes money out of the account, and a withdrawal puts it back.
  const vault: LogRow[] = account.vaultEntries.map((e) => {
    const arrow = e.amount > 0 ? "→" : "←";
    return {
      id: e.id,
      kind: "vault",
      chip: { tone: "positive", label: "Vault" },
      amount: -e.amount,
      date: e.date,
      text: e.notes ? `${e.notes} · ${arrow} ${e.vaultName}` : `${arrow} ${e.vaultName}`,
    };
  });
  return [...entries, ...vault].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function LogRowItem({ row, onDelete, pending }: { row: LogRow; onDelete: () => void; pending: boolean }) {
  const date = new Date(row.date).toLocaleDateString("es-CO", { month: "short", day: "numeric", year: "2-digit" });
  return (
    <li className="group/row grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-0.5 px-5 py-2.5 sm:grid-cols-[6rem_6rem_1fr_auto_1.75rem]">
      <span className="col-span-3 flex min-w-0 items-center gap-2 whitespace-nowrap text-xs text-muted-foreground sm:col-span-1">
        <span className="sm:hidden">
          <StatusChip tone={row.chip.tone}>{row.chip.label}</StatusChip>
        </span>
        {date}
      </span>
      <span className="hidden sm:block">
        <StatusChip tone={row.chip.tone}>{row.chip.label}</StatusChip>
      </span>
      <span className="min-w-0 truncate text-sm text-muted-foreground">{row.text}</span>
      <Money value={row.amount} signed tone={row.amount < 0 ? "danger" : "positive"} className="text-sm font-medium" />
      {row.kind === "entry" ? (
        <RowDeleteButton label="Delete entry" onDelete={onDelete} disabled={pending} className="sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-visible:opacity-100" />
      ) : (
        // Vault movements are managed from the vault itself.
        <span className="size-7" />
      )}
    </li>
  );
}

export function AccountLogDialog({
  open,
  onClose,
  account,
  onAddEntry,
}: {
  open: boolean;
  onClose: () => void;
  account: AccountWithBalance;
  onAddEntry: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const rows = buildLogRows(account);

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <ColorDot color={account.color} className="size-2.5" />
          {account.name} · log
        </span>
      }
      footer={
        <FormFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={onAddEntry}>
            <Plus aria-hidden />
            Add entry
          </Button>
        </FormFooter>
      }
    >
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No entries yet.</p>
      ) : (
        <ul className="-mx-5 divide-y divide-border/40">
          {rows.map((row) => (
            <LogRowItem
              key={`${row.kind}-${row.id}`}
              row={row}
              pending={pending}
              onDelete={() => startTransition(async () => { await deleteEntry(row.id); })}
            />
          ))}
        </ul>
      )}
    </FormDialog>
  );
}
