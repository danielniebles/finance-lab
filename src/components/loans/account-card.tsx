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
import { EntryForm } from "./entry-form";
import type { AccountWithBalance } from "@/lib/queries/loans";

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
    <span className="rounded-full bg-blue-500/10 text-blue-400 px-1.5 py-0.5 text-xs font-medium">Opening</span>
  ) : (
    <span className="rounded-full bg-violet-500/10 text-violet-400 px-1.5 py-0.5 text-xs font-medium">Adjustment</span>
  );
}

export function AccountCard({ account }: { account: AccountWithBalance }) {
  const [editOpen, setEditOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();
  const [deleteEntryPending, startDeleteEntry] = useTransition();

  const isNegative = account.balance < 0;
  const isExcluded = !account.includeInAvailable;

  function handleDelete() {
    if (!confirm(`Delete "${account.name}"? This will also remove all its entries and loans.`)) return;
    startDelete(async () => { await deleteAccount(account.id); });
  }

  function handleDeleteEntry(id: string) {
    startDeleteEntry(async () => { await deleteEntry(id); });
  }

  return (
    <>
      <div className={cn("rounded-xl border bg-card overflow-hidden", isExcluded && "opacity-60")}>
        <div className="p-4 space-y-3 group">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="size-3 rounded-full shrink-0"
                style={{ backgroundColor: account.color ?? "#888" }}
              />
              <span className="font-medium text-sm">{account.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <AccountTypeBadge type={account.accountType} />
              {isExcluded && (
                <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground ml-1">
                  excluded
                </span>
              )}
            </div>
          </div>

          {/* Balance */}
          <p className={cn("font-mono text-lg font-semibold", isNegative ? "text-destructive" : "text-foreground")}>
            {formatCOP(account.balance)}
          </p>
          {account.loansOut > 0 && (
            <p className="text-xs text-muted-foreground font-mono">
              {formatCOP(account.loansOut)}{" "}
              <span className="font-sans text-muted-foreground/70">in loans</span>
            </p>
          )}

          {/* Actions — visible on hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs flex-1"
              onClick={() => setEntryOpen(true)}
            >
              <Plus className="size-3" />
              Add entry
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs"
              onClick={() => setLogOpen(true)}
            >
              <ScrollText className="size-3" />
              Log
            </Button>
            <Button variant="ghost" size="icon" className="size-6" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deletePending}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        </div>

      </div>

      <AccountForm open={editOpen} onClose={() => setEditOpen(false)} editing={account} />
      <EntryForm open={entryOpen} onClose={() => setEntryOpen(false)} account={account} />

      {/* Entry log dialog */}
      <Dialog open={logOpen} onOpenChange={(o: boolean) => setLogOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className="size-3 rounded-full shrink-0"
                style={{ backgroundColor: account.color ?? "#888" }}
              />
              {account.name} — Entry log
            </DialogTitle>
          </DialogHeader>

          {account.entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No entries yet.</p>
          ) : (
            <div className="max-h-[60vh] overflow-x-auto overflow-y-auto -mx-6 divide-y divide-border/40">
              {account.entries.map((entry) => (
                <div key={entry.id} className="grid grid-cols-[5rem_6.5rem_8rem_1fr_1.25rem] items-center gap-x-3 px-6 py-2.5 group/row hover:bg-muted/20">
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                  </span>
                  <EntryTypeBadge type={entry.type} />
                  <span className={cn("font-mono text-xs font-medium", entry.amount < 0 ? "text-destructive" : "text-success")}>
                    {entry.amount >= 0 ? "+" : ""}{formatCOP(entry.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {entry.notes ?? ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-5 opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteEntry(entry.id)}
                    disabled={deleteEntryPending}
                  >
                    <Trash className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => { setLogOpen(false); setEntryOpen(true); }}
            >
              <Plus className="size-3" />
              Add entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
