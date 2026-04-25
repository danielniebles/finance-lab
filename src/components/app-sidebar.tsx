"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { BarChart3, CreditCard, HandCoins, Settings, ChevronDown, Bot, TrendingUp, Sun, Moon } from "lucide-react";
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
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const navItems = [
  { title: "Expenses", href: "/expenses", icon: BarChart3 },
  { title: "Trends", href: "/trends", icon: TrendingUp },
  { title: "Installments", href: "/installments", icon: CreditCard },
  { title: "Loans", href: "/loans", icon: HandCoins },
  { title: "Advisor", href: "/chat", icon: Bot },
];

const settingsItems = [
  { title: "Categories", href: "/settings/categories" },
  { title: "Mappings", href: "/settings/mappings" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [theme, setThemeState] = useState<"dark" | "light">("dark");

  useEffect(() => {
    setThemeState(
      document.documentElement.classList.contains("light") ? "light" : "dark"
    );
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setThemeState(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.classList.toggle("light", next === "light");
    document.cookie = `theme=${next};path=/;max-age=31536000;SameSite=Lax`;
  }

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5">
        <span className="font-heading text-base font-semibold tracking-tight text-foreground">
          Finance Lab
        </span>
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
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
            <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1 text-xs font-medium text-sidebar-foreground/70">
              <span className="flex items-center gap-2">
                <Settings className="size-4" />
                Settings
              </span>
              <ChevronDown className="size-3 transition-transform data-[state=open]:rotate-180" />
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
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
