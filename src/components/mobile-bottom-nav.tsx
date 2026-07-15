"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BarChart3, CreditCard, HandCoins, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

const items = [
  { title: "Overview", href: "/overview", icon: LayoutDashboard },
  { title: "Expenses", href: "/expenses", icon: BarChart3 },
  { title: "Installments", href: "/installments", icon: CreditCard },
  { title: "Loans", href: "/loans", icon: HandCoins },
];

// Routes surfaced via the sidebar sheet rather than a dedicated tab.
const moreRoutes = ["/trends", "/vaults", "/chat", "/settings"];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const isMoreActive = moreRoutes.some((href) => pathname.startsWith(href));

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:hidden"
    >
      <nav
        aria-label="Primary"
        className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-white/10 bg-card/70 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/60"
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
    </div>
  );
}
