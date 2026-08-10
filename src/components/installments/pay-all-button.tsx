"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { WalletSelect, type WalletOption } from "@/components/shared/wallet-select";
import { formatCOP, dateInputValue } from "@/lib/format";
import { payInstallmentsBulk } from "@/lib/actions/installments";
import type { CategoryOption } from "@/lib/queries/expenses";
import type { DueThisMonth } from "@/lib/queries/installments";

// Prefilled note listing what's being paid — editable before confirming, same
// "generate a sane default, let the user override" pattern as add-transaction-row.
function defaultNote(items: DueThisMonth[]): string {
  return items
    .map(
      (d) =>
        `${d.installment.description} (cuota ${d.installmentNum}/${d.installment.numInstallments})`,
    )
    .join(", ");
}

type Props = {
  items: DueThisMonth[];
  walletOptions: WalletOption[];
  categories: CategoryOption[];
  onPaid: () => void;
};

export function PayAllButton({ items, walletOptions, categories, onPaid }: Props) {
  const [open, setOpen] = useState(false);
  const [walletId, setWalletId] = useState("");
  const [appCategoryId, setAppCategoryId] = useState("");
  const [date, setDate] = useState(() => dateInputValue(new Date()));
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const total = useMemo(() => items.reduce((s, d) => s + d.amount, 0), [items]);
  const canSubmit = walletId !== "" && appCategoryId !== "" && date !== "" && items.length > 0;

  function openDialog() {
    setNote(defaultNote(items));
    setDate(dateInputValue(new Date()));
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const walletName = walletOptions.find((w) => w.id === walletId)?.name ?? "";
    const slots = items.map((d) => ({
      installmentId: d.installment.id,
      installmentNum: d.installmentNum,
    }));
    startTransition(async () => {
      try {
        const result = await payInstallmentsBulk(slots, {
          walletId,
          wallet: walletName,
          appCategoryId,
          date: new Date(date + "T12:00:00"),
          note,
        });
        toast.success(
          result.loansCreated > 0
            ? `Paid ${items.length} installments — ${result.loansCreated} loan${result.loansCreated > 1 ? "s" : ""} recorded`
            : `Paid ${items.length} installments`,
        );
        setOpen(false);
        onPaid();
      } catch {
        toast.error("Couldn't pay selected installments");
      }
    });
  }

  return (
    <>
      <Button size="sm" onClick={openDialog} className="h-7 gap-1.5 text-xs">
        Pay all ({items.length})
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay {items.length} installments</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <CategorySelect
                  value={appCategoryId}
                  categories={categories}
                  onChange={setAppCategoryId}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Wallet</Label>
                <WalletSelect value={walletId} options={walletOptions} onChange={setWalletId} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-all-date">Date</Label>
              <Input
                id="pay-all-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-all-note">Note</Label>
              <textarea
                id="pay-all-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="font-mono text-sm font-semibold">{formatCOP(total)}</span>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !canSubmit}>
                Confirm payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CategorySelect({
  value,
  categories,
  onChange,
}: {
  value: string;
  categories: CategoryOption[];
  onChange: (v: string) => void;
}) {
  const selectedName = categories.find((c) => c.id === value)?.name ?? "Category";
  return (
    <Select value={value || undefined} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="w-full" aria-label="Category">
        <span className="text-sm truncate">{selectedName}</span>
      </SelectTrigger>
      <SelectContent>
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
