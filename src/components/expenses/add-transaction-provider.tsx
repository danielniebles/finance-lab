"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AddTransactionDialog, type AddTransactionData } from "@/components/expenses/add-transaction-dialog";

type ContextValue = {
  /** Opens Add transaction, prefilled with this wallet when given. */
  openAddTransaction: (walletId?: string) => void;
};

const AddTransactionContext = createContext<ContextValue | null>(null);

export function useAddTransaction(): ContextValue {
  const value = useContext(AddTransactionContext);
  if (!value) throw new Error("useAddTransaction must be used inside AddTransactionProvider");
  return value;
}

/**
 * Holds the one Add transaction dialog for the whole app shell, so every
 * trigger (a page's header action, the phones' global "+") opens the same
 * form. Its data (categories, tags, wallets) is loaded once by the (app)
 * layout.
 */
export function AddTransactionProvider({ data, children }: { data: AddTransactionData; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [walletId, setWalletId] = useState<string | undefined>();

  const openAddTransaction = useCallback((id?: string) => {
    setWalletId(id);
    setOpen(true);
  }, []);
  const value = useMemo(() => ({ openAddTransaction }), [openAddTransaction]);

  return (
    <AddTransactionContext.Provider value={value}>
      {children}
      <AddTransactionDialog {...data} open={open} activeWalletId={walletId} onClose={() => setOpen(false)} />
    </AddTransactionContext.Provider>
  );
}
