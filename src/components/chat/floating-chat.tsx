"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X, Maximize2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChat } from "./chat-provider";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";

export function FloatingChat() {
  const pathname = usePathname();
  const { isOpen, openChat, closeChat, items, isLoading, sendMessage, context, setContext } = useChat();

  // Set default route context from pathname, but only if route isn't already set
  useEffect(() => {
    if (!context.route) {
      setContext({ ...context, route: pathname });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Hide on the full chat page
  if (pathname === "/chat") return null;

  return (
    <>
      {/* Panel */}
      <div
        className={cn(
          "fixed bottom-20 right-6 z-50 w-80 rounded-2xl border border-border bg-card shadow-2xl flex flex-col transition-all duration-200 origin-bottom-right",
          isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
        )}
        style={{ height: "420px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="text-sm font-medium">Financial Advisor</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              render={<Link href="/chat" onClick={() => closeChat()} />}
              nativeButton={false}
            >
              <Maximize2 className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-6" onClick={closeChat}>
              <X className="size-3.5" />
            </Button>
          </div>
        </div>

        <ChatMessages items={items} isLoading={isLoading} />
        <ChatInput
          onSend={sendMessage}
          disabled={isLoading}
          hasHistory={items.length > 0}
          onUndo={() => sendMessage("undo last")}
        />
      </div>

      {/* Toggle button */}
      <Button
        size="icon"
        className="fixed bottom-6 right-6 z-50 size-12 rounded-full shadow-lg"
        onClick={() => (isOpen ? closeChat() : openChat())}
      >
        {isOpen ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </Button>
    </>
  );
}
