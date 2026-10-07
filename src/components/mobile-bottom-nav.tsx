"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BarChart3, CreditCard, HandCoins, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { useAddTransaction } from "@/components/expenses/add-transaction-provider";
import { ALL_WALLETS, LEDGER_WALLET_COOKIE } from "@/lib/expenses-ledger-display";

const items = [
  { title: "Overview", href: "/overview", icon: LayoutDashboard },
  { title: "Expenses", href: "/expenses", icon: BarChart3 },
  { title: "Installments", href: "/installments", icon: CreditCard },
  { title: "Loans", href: "/loans", icon: HandCoins },
];

// Routes surfaced via the sidebar sheet rather than a dedicated tab.
const moreRoutes = ["/trends", "/vaults", "/chat", "/settings"];

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

// The wallet the current screen is scoped to: ?walletId=, else (on Expenses)
// the ledger's remembered wallet. Read at click time, so no hydration
// mismatch and no Suspense needed for useSearchParams.
function contextWalletId(pathname: string): string | undefined {
  const fromUrl = new URLSearchParams(window.location.search).get("walletId") ?? undefined;
  const id = fromUrl ?? (pathname.startsWith("/expenses") ? readCookie(LEDGER_WALLET_COOKIE) : undefined);
  return id && id !== ALL_WALLETS ? id : undefined;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { openAddTransaction } = useAddTransaction();
  const isMoreActive = moreRoutes.some((href) => pathname.startsWith(href));

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2.5 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:hidden"
    >
      <nav
        aria-label="Primary"
        className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-border/60 bg-card/70 p-1.5 shadow-xl backdrop-blur-xl supports-[backdrop-filter]:bg-card/60"
      >
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex size-12 items-center justify-center rounded-full transition-colors",
                isActive ? "bg-primary/15 text-primary" : "text-muted-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon className="size-5" aria-hidden="true" />
              <span className="sr-only">{item.title}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className={cn(
            "flex size-12 items-center justify-center rounded-full transition-colors",
            isMoreActive ? "bg-primary/15 text-primary" : "text-muted-foreground",
          )}
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
          <span className="sr-only">More</span>
        </button>
      </nav>
      {/* Always Add transaction, on every screen; page-specific actions stay in the page header. */}
      <button
        type="button"
        onClick={() => openAddTransaction(contextWalletId(pathname))}
        className="pointer-events-auto flex size-15 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform active:scale-95"
      >
        <Plus className="size-6" aria-hidden="true" />
        <span className="sr-only">Add transaction</span>
      </button>
    </div>
  );
}
