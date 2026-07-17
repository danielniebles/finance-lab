"use client";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

export type WalletOption = { id: string; name: string };

/**
 * Shared by every plain wallet-id dropdown in the app — binds value={w.id}
 * and passes the id straight through, so the caller's write path
 * (`walletId` param) bypasses `resolveWalletId`'s collision-prone name
 * lookup (Wallet names are only unique per-account). Was duplicated 4x
 * (add-transaction-row.tsx's `CreateWalletSelect`, transaction-row.tsx's
 * `EditWalletSelect`, ledger-controls.tsx's filter `WalletSelect`,
 * rule-list.tsx's `WalletSelect`) — identical value/options/onChange +
 * null-guard, differing only in trigger sizing/label; consolidated here,
 * with `className`/`ariaLabel`/`placeholder` covering that variance.
 *
 * ledger-controls.tsx's "All wallets" filter option is deliberately NOT
 * special-cased here: that caller gets it by prepending a synthetic
 * `{ id: ALL_SENTINEL, name: "All wallets" }` option to `options` and
 * mapping the sentinel id back to its own "no filter" value — this
 * component only ever deals in real id/name pairs, so `value`/`onChange`
 * stay required strings for every caller.
 *
 * `invalid` forwards to the trigger's `aria-invalid`, which `ui/select.tsx`
 * already styles with a destructive border/ring — pass it to flag a
 * required-but-empty selection instead of only disabling Save silently.
 */
export function WalletSelect({
  value,
  options,
  onChange,
  className = "w-full",
  ariaLabel = "Wallet",
  placeholder = "Wallet",
  invalid = false,
}: {
  value: string;
  options: WalletOption[];
  onChange: (v: string) => void;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
  invalid?: boolean;
}) {
  const selectedName = options.find((w) => w.id === value)?.name ?? placeholder;
  return (
    <Select value={value || undefined} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className={className} aria-label={ariaLabel} aria-invalid={invalid}>
        <span className="text-sm truncate">{selectedName}</span>
      </SelectTrigger>
      <SelectContent>
        {options.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
