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
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
    >
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <item.icon className="size-5" aria-hidden="true" />
            {item.title}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setOpenMobile(true)}
        className={cn(
          "flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
          isMoreActive ? "text-primary" : "text-muted-foreground",
        )}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
        More
      </button>
    </nav>
  );
}
