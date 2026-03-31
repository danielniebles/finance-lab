"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/components/chat/chat-provider";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";

export default function ChatPage() {
  const { messages, isLoading, sendMessage, clearHistory } = useChat();

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
            <Trash2 className="size-3.5" />
            Clear history
          </Button>
        )}
      </div>

      <ChatMessages messages={messages} isLoading={isLoading} />
      <div className="px-4 pb-4">
        <div className="rounded-xl border border-border bg-card max-w-3xl mx-auto">
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </div>
    </div>
  );
}
