import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ChatProvider } from "@/components/chat/chat-provider";
import { AddTransactionProvider } from "@/components/expenses/add-transaction-provider";
import type { AddTransactionData } from "@/components/expenses/add-transaction-dialog";
import { getCategories } from "@/lib/queries/expenses";
import { getTags } from "@/lib/queries/tags";
import { getWalletBalances } from "@/lib/queries/wallets";

export const dynamic = "force-dynamic";

/** What the shell's one Add transaction dialog needs (header actions + the phones' "+"). */
async function loadAddTransactionData(): Promise<AddTransactionData> {
  const [categories, tags, walletBalances] = await Promise.all([getCategories(), getTags(), getWalletBalances()]);
  const walletOptions = walletBalances.accounts.flatMap((account) =>
    account.wallets.map((wallet) => ({ id: wallet.id, name: wallet.name })),
  );
  return { categories, tags, walletOptions };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const addTransactionData = await loadAddTransactionData();
  return (
    <ChatProvider>
      <AddTransactionProvider data={addTransactionData}>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-13 shrink-0 items-center gap-3 border-b border-border/60 px-5 backdrop-blur-sm">
              <SidebarTrigger className="-ml-1 hidden text-muted-foreground hover:text-foreground md:inline-flex" />
              <div className="hidden h-4 w-px bg-border md:block" />
              <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                Finance Lab
              </span>
            </header>
            <main className="flex-1 overflow-auto p-6 pb-28 md:pb-6">
              <div className="mx-auto w-full max-w-7xl">{children}</div>
            </main>
          </SidebarInset>
          <MobileBottomNav />
        </SidebarProvider>
      </AddTransactionProvider>
    </ChatProvider>
  );
}
