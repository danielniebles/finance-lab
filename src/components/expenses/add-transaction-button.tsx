"use client";

import { HeaderAction } from "@/components/ds";
import { useAddTransaction } from "@/components/expenses/add-transaction-provider";

/**
 * A page header's "Add transaction" (DESIGN.md §7 "Page actions"). On phones
 * pass `className="max-sm:hidden"`: the global "+" next to the bottom nav is
 * Add transaction there.
 */
export function AddTransactionButton({ activeWalletId, className }: { activeWalletId?: string; className?: string }) {
  const { openAddTransaction } = useAddTransaction();
  return (
    <div className={className}>
      <HeaderAction label="Add transaction" onClick={() => openAddTransaction(activeWalletId)} />
    </div>
  );
}
