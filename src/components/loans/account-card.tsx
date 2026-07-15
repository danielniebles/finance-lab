"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, ScrollText, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/format";
import { deleteAccount, deleteEntry } from "@/lib/actions/loans";
import { AccountForm } from "./account-form";
import { EntryForm } from "./account-entry-form";
import type { AccountWithBalance } from "@/lib/queries/loans";
import { MASK } from "./lib/constants";

// ─── Badge sub-components ─────────────────────────────────────────────────────

function AccountTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    BANK:    "bg-blue-500/10 text-blue-400",
    DIGITAL: "bg-violet-500/10 text-violet-400",
    PENSION: "bg-amber-500/10 text-amber-400",
  };
  const label: Record<string, string> = { BANK: "Bank", DIGITAL: "Digital", PENSION: "AFP" };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", map[type] ?? map.BANK)}>
      {label[type] ?? type}
    </span>
  );
}

function EntryTypeBadge({ type }: { type: string }) {
  return type === "INITIAL" ? (
    <span className="rounded-full bg-blue-500/10 text-blue-400 px-1.5 py-0.5 text-xs font-medium w-fit">Opening</span>
  ) : (
    <span className="rounded-full bg-violet-500/10 text-violet-400 px-1.5 py-0.5 text-xs font-medium w-fit">Adjustment</span>
  );
}

function VaultBadge() {
  return (
    <span className="rounded-full bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 text-xs font-medium w-fit">
      Vault
    </span>
  );
}

// ─── Entry log types and helpers ──────────────────────────────────────────────

type EntryLogRow = { kind: "entry"; id: string; type: string; amount: number; date: Date; notes: string | null };
type VaultLogRow = { kind: "vault"; id: string; amount: number; date: Date; notes: string | null; vaultName: string };
type LogRow = EntryLogRow | VaultLogRow;

function buildLogRows(account: AccountWithBalance): LogRow[] {
  return [
    ...account.entries.map((e) => ({ kind: "entry" as const, ...e })),
    ...account.vaultEntries.map((e) => ({ kind: "vault" as const, ...e })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── Log row sub-components ───────────────────────────────────────────────────

function amountColorClass(amount: number): string {
  return amount < 0 ? "text-destructive" : "text-success";
}

function EntryLogRowItem({
  row,
  onDelete,
  deletePending,
}: {
  row: EntryLogRow;
  onDelete: (id: string) => void;
  deletePending: boolean;
}) {
  const dateLabel = new Date(row.date).toLocaleDateString("es-CO", { month: "short", day: "numeric", year: "2-digit" });

  return (
    <div className="group/row hover:bg-muted/20">
      {/* Mobile: stacked row — the 5-column fixed grid needs ~400px minimum
          and forces horizontal scroll below that. */}
      <div className="flex flex-col gap-1 px-6 py-2.5 sm:hidden">
        <div className="flex items-center justify-between gap-2">
          <EntryTypeBadge type={row.type} />
          <span className={cn("font-mono text-xs font-medium shrink-0", amountColorClass(row.amount))}>
            {row.amount >= 0 ? "+" : ""}{formatCOP(row.amount)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">
            {dateLabel}
            {row.notes ? ` · ${row.notes}` : ""}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(row.id)}
            disabled={deletePending}
          >
            <Trash className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="hidden sm:grid grid-cols-[5rem_6.5rem_8rem_1fr_1.25rem] items-center gap-x-3 px-6 py-2.5">
        <span className="text-xs text-muted-foreground">{dateLabel}</span>
        <EntryTypeBadge type={row.type} />
        <span className={cn("font-mono text-xs font-medium", amountColorClass(row.amount))}>
          {row.amount >= 0 ? "+" : ""}{formatCOP(row.amount)}
        </span>
        <span className="text-xs text-muted-foreground truncate">{row.notes ?? ""}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-5 opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(row.id)}
          disabled={deletePending}
        >
          <Trash className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function VaultLogRowItem({ row }: { row: VaultLogRow }) {
  const displayAmount = -row.amount;
  const direction = row.amount > 0 ? "→" : "←";
  const label = row.notes ? `${row.notes} · ${direction} ${row.vaultName}` : `${direction} ${row.vaultName}`;
  const dateLabel = new Date(row.date).toLocaleDateString("es-CO", { month: "short", day: "numeric", year: "2-digit" });

  return (
    <div className="hover:bg-muted/20">
      <div className="flex flex-col gap-1 px-6 py-2.5 sm:hidden">
        <div className="flex items-center justify-between gap-2">
          <VaultBadge />
          <span className={cn("font-mono text-xs font-medium shrink-0", amountColorClass(displayAmount))}>
            {displayAmount >= 0 ? "+" : ""}{formatCOP(displayAmount)}
          </span>
        </div>
        <span className="truncate text-xs text-muted-foreground">
          {dateLabel} · {label}
        </span>
      </div>

      <div className="hidden sm:grid grid-cols-[5rem_6.5rem_8rem_1fr_1.25rem] items-center gap-x-3 px-6 py-2.5">
        <span className="text-xs text-muted-foreground">{dateLabel}</span>
        <VaultBadge />
        <span className={cn("font-mono text-xs font-medium", amountColorClass(displayAmount))}>
          {displayAmount >= 0 ? "+" : ""}{formatCOP(displayAmount)}
        </span>
        <span className="text-xs text-muted-foreground truncate">{label}</span>
        <span />
      </div>
    </div>
  );
}

// ─── Entry log dialog ─────────────────────────────────────────────────────────

function AccountEntryLog({
  open,
  onClose,
  account,
  onAddEntry,
  onDeleteEntry,
  deleteEntryPending,
}: {
  open: boolean;
  onClose: () => void;
  account: AccountWithBalance;
  onAddEntry: () => void;
  onDeleteEntry: (id: string) => void;
  deleteEntryPending: boolean;
}) {
  const logRows = buildLogRows(account);

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: account.color ?? "#888" }} />
            {account.name} — Entry log
          </DialogTitle>
        </DialogHeader>

        {logRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto -mx-6 divide-y divide-border/40">
            {logRows.map((row) =>
              row.kind === "entry" ? (
                <EntryLogRowItem
                  key={row.id}
                  row={row}
                  onDelete={onDeleteEntry}
                  deletePending={deleteEntryPending}
                />
              ) : (
                <VaultLogRowItem key={row.id} row={row} />
              )
            )}
          </div>
        )}

        <div className="pt-2 border-t border-border/40">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            onClick={onAddEntry}
          >
            <Plus className="size-3.5" />
            Add entry
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExclusionBadges({ isExcluded, isExcludedFromTotal }: { isExcluded: boolean; isExcludedFromTotal: boolean }) {
  if (!isExcluded && !isExcludedFromTotal) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {isExcluded && (
        <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
          excluded
        </span>
      )}
      {isExcludedFromTotal && (
        <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
          hidden
        </span>
      )}
    </div>
  );
}

// ─── Account card ─────────────────────────────────────────────────────────────

export function AccountCard({ account, masked }: { account: AccountWithBalance; masked?: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();
  const [deleteEntryPending, startDeleteEntry] = useTransition();

  const isNegative = account.balance < 0;
  const isExcluded = !account.includeInAvailable;
  const isExcludedFromTotal = !account.includeInOverviewTotal;

  function handleDelete() {
    if (!confirm(`Delete "${account.name}"? This will also remove all its entries and loans.`)) return;
    startDelete(async () => { await deleteAccount(account.id); });
  }

  function handleDeleteEntry(id: string) {
    startDeleteEntry(async () => { await deleteEntry(id); });
  }

  return (
    <>
      <div className={cn("h-full rounded-xl border bg-card overflow-hidden", (isExcluded || isExcludedFromTotal) && "opacity-60")}>
        <div className="p-4 flex flex-col gap-3 h-full">
          {/* Header */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: account.color ?? "#888" }} />
                <span className="font-medium text-sm truncate">{account.name}</span>
              </div>
              <AccountTypeBadge type={account.accountType} />
            </div>
            <ExclusionBadges isExcluded={isExcluded} isExcludedFromTotal={isExcludedFromTotal} />
          </div>

          {/* Balance */}
          <div className="flex-1">
            <p className={cn("font-mono text-lg font-semibold", masked ? "text-muted-foreground tracking-widest" : isNegative ? "text-destructive" : "text-foreground")}>
              {masked ? MASK : formatCOP(account.balance)}
            </p>
            {account.loansOut > 0 && (
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                <span className="font-sans text-muted-foreground/70">+ lent </span>
                {masked ? MASK : formatCOP(account.loansOut)}
                <span className="font-sans text-muted-foreground/50"> = {masked ? MASK : formatCOP(account.balance + account.loansOut)}</span>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 pt-1 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs flex-1"
              onClick={() => setEntryOpen(true)}
            >
              <Plus className="size-3.5" />
              Add entry
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs"
              onClick={() => setLogOpen(true)}
            >
              <ScrollText className="size-3.5" />
              Log
            </Button>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deletePending}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <AccountForm open={editOpen} onClose={() => setEditOpen(false)} editing={account} />
      <EntryForm open={entryOpen} onClose={() => setEntryOpen(false)} account={account} />
      <AccountEntryLog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        account={account}
        onAddEntry={() => { setLogOpen(false); setEntryOpen(true); }}
        onDeleteEntry={handleDeleteEntry}
        deleteEntryPending={deleteEntryPending}
      />
    </>
  );
}
