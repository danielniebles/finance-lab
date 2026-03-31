import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatProvider } from "@/components/chat/chat-provider";
import { FloatingChat } from "@/components/chat/floating-chat";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-13 shrink-0 items-center gap-3 border-b border-border/60 px-5 backdrop-blur-sm">
            <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
            <div className="h-4 w-px bg-border" />
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Finance Lab
            </span>
          </header>
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </SidebarInset>
        <FloatingChat />
      </SidebarProvider>
    </ChatProvider>
  );
}
