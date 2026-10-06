"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, ScrollText, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { TONE_CLASSES } from "@/lib/status";
import { formatCOP } from "@/lib/format";
import { deleteAccount } from "@/lib/actions/loans";
import { AccountForm } from "./account-form";
import { EntryForm } from "./account-entry-form";
import { AccountLogDialog } from "./account-log-dialog";
import type { AccountWithBalance } from "@/lib/queries/loans";
import { MASK } from "./lib/constants";
import { ColorDot, FormDialog, FormFooter } from "@/components/ds";

// ─── Badge sub-components ─────────────────────────────────────────────────────

function AccountTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    BANK:    TONE_CLASSES.info.soft,
    DIGITAL: TONE_CLASSES.neutral.soft,
    PENSION: TONE_CLASSES.caution.soft,
  };
  const label: Record<string, string> = { BANK: "Bank", DIGITAL: "Digital", PENSION: "AFP" };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", map[type] ?? map.BANK)}>
      {label[type] ?? type}
    </span>
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

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteAccountDialog({ open, onClose, account }: { open: boolean; onClose: () => void; account: AccountWithBalance }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setError(null);
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAccount(account.id);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Delete ${account.name}?`}
      footer={
        <FormFooter hint={error ? <span className={TONE_CLASSES.danger.text}>{error}</span> : undefined}>
          <Button type="button" variant="outline" onClick={onClose} autoFocus>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={pending || !!error} onClick={handleDelete}>
            {pending ? "Deleting…" : "Delete account"}
          </Button>
        </FormFooter>
      }
    >
      <p className="text-sm text-muted-foreground">
        Its {account.entries.length} {account.entries.length === 1 ? "entry is" : "entries are"} deleted with it. An
        account that still has loans or transfers can&apos;t be deleted.
      </p>
    </FormDialog>
  );
}

// ─── Account card ─────────────────────────────────────────────────────────────

export function AccountCard({ account, masked }: { account: AccountWithBalance; masked?: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isNegative = account.balance < 0;
  const isExcluded = !account.includeInAvailable;
  const isExcludedFromTotal = !account.includeInOverviewTotal;


  return (
    <>
      <div className={cn("h-full rounded-xl border bg-card overflow-hidden", (isExcluded || isExcludedFromTotal) && "opacity-60")}>
        <div className="p-4 flex flex-col gap-3 h-full">
          {/* Header */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <ColorDot color={account.color} className="size-3" />
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
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="size-6">
                    <MoreHorizontal className="size-3.5" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLogOpen(true)}>
                  <ScrollText className="size-3.5" />
                  Log
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="size-3.5" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="size-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <AccountForm open={editOpen} onClose={() => setEditOpen(false)} editing={account} />
      <EntryForm open={entryOpen} onClose={() => setEntryOpen(false)} account={account} />
      <AccountLogDialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        account={account}
        onAddEntry={() => { setLogOpen(false); setEntryOpen(true); }}
      />
      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} account={account} />
    </>
  );
}
