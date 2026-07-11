"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/components/chat/chat-provider";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";

export default function ChatPage() {
  const { items, messages, isLoading, sendMessage, clearHistory } = useChat();

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Financial Advisor</h1>
          <p className="text-sm text-muted-foreground">Ask anything about your finances</p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={clearHistory}
          >
            <Trash2 className="size-4" />
            Clear history
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col max-w-3xl w-full mx-auto">
        <ChatMessages items={items} isLoading={isLoading} />
      </div>
      <div className="px-4 pb-4">
        <div className="rounded-xl border border-border bg-card max-w-3xl mx-auto">
          <ChatInput
            onSend={sendMessage}
            disabled={isLoading}
            hasHistory={items.length > 0}
            onUndo={() => sendMessage("undo last")}
          />
        </div>
      </div>
    </div>
  );
}
