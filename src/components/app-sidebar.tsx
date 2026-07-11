"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, CreditCard, HandCoins, PiggyBank, Settings, ChevronDown, Bot, TrendingUp, Sun, Moon, LayoutDashboard } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const navItems = [
  { title: "Overview", href: "/overview", icon: LayoutDashboard },
  { title: "Expenses", href: "/expenses", icon: BarChart3 },
  { title: "Trends", href: "/trends", icon: TrendingUp },
  { title: "Installments", href: "/installments", icon: CreditCard },
  { title: "Loans", href: "/loans", icon: HandCoins },
  { title: "Vaults", href: "/vaults", icon: PiggyBank },
  { title: "Advisor", href: "/chat", icon: Bot },
];

const settingsItems = [
  { title: "Categories", href: "/settings/categories" },
  { title: "Mappings", href: "/settings/mappings" },
  { title: "Rules", href: "/settings/rules" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [theme, setThemeState] = useState<"dark" | "light">(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("light") ? "light" : "dark"
  );

  // Close the mobile sheet whenever the route changes — nothing else does
  // this today, so a nav click on mobile navigates but leaves the sheet open.
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.classList.toggle("light", next === "light");
    document.cookie = `theme=${next};path=/;max-age=31536000;SameSite=Lax`;
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        <span className="font-heading text-base font-semibold tracking-tight text-foreground group-data-[collapsible=icon]:hidden">
          Finance Lab
        </span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground group-data-[collapsible=icon]:hidden">
          Personal Tracker
        </span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.title}
                  >
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <Collapsible defaultOpen={pathname.startsWith("/settings")}>
            <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1 text-xs font-medium text-sidebar-foreground/70 group-data-[collapsible=icon]:justify-center">
              <span className="flex items-center gap-2">
                <Settings className="size-4" />
                <span className="group-data-[collapsible=icon]:hidden">Settings</span>
              </span>
              <ChevronDown className="size-3 transition-transform data-[state=open]:rotate-180 group-data-[collapsible=icon]:hidden" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuSub>
                      {settingsItems.map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton
                            render={<Link href={item.href} />}
                            isActive={pathname === item.href}
                          >
                            {item.title}
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 py-3">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors group-data-[collapsible=icon]:justify-center"
        >
          {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          <span className="group-data-[collapsible=icon]:hidden">
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </span>
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
