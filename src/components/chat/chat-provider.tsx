"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { getMessages, clearHistory as clearHistoryDB } from "@/lib/actions/chat";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
};

export type ProposalEvent = {
  id: string; // local React key (crypto.randomUUID())
  type: "proposal";
  action: string;
  params: Record<string, unknown>;
  label: string;
  proposalId?: string; // DB id from backend — used by ActionCard to resolve
  approved: boolean | null; // null = pending, true = approved, false = dismissed
};

export type ChatModuleContext = {
  route?: string;
  module?: string;
  focus?: { month: number; year: number };
  entityId?: string;
};

export type ChatItem = Message | ProposalEvent;

type ChatContextValue = {
  messages: Message[];
  items: ChatItem[];
  isLoading: boolean;
  isOpen: boolean;
  context: ChatModuleContext;
  setContext: (ctx: ChatModuleContext) => void;
  openChat: (ctx?: ChatModuleContext) => void;
  closeChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  updateProposal: (id: string, approved: boolean) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside ChatProvider");
  return ctx;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContextState] = useState<ChatModuleContext>({});
  const initialized = useRef(false);

  // Load persisted messages on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    getMessages().then((rows) => {
      const msgs = rows as Message[];
      setMessages(msgs);
      setItems(msgs);
    });
  }, []);

  const setContext = useCallback((ctx: ChatModuleContext) => {
    setContextState(ctx);
  }, []);

  const openChat = useCallback((ctx?: ChatModuleContext) => {
    if (ctx) setContextState(ctx);
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const updateProposal = useCallback((id: string, approved: boolean) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && "type" in item && (item as ProposalEvent).type === "proposal"
          ? { ...(item as ProposalEvent), approved }
          : item
      )
    );
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    // Optimistically add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setItems((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 90_000); // 90s for tool loops

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, context }),
        signal: abort.signal,
      });
      clearTimeout(timeout);

      if (!res.ok || !res.body) throw new Error("API error");

      // Add empty assistant message placeholder
      const assistantId = crypto.randomUUID();
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setItems((prev) => [...prev, assistantMsg]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let textAccum = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete NDJSON lines
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete last line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed) as { type: string; delta?: string; action?: string; params?: Record<string, unknown>; label?: string; proposalId?: string };
            if (event.type === "text" && event.delta) {
              textAccum += event.delta;
              const captured = textAccum;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: captured } : m))
              );
              setItems((prev) =>
                prev.map((item) =>
                  item.id === assistantId ? { ...(item as Message), content: captured } : item
                )
              );
            } else if (event.type === "proposal") {
              const proposal: ProposalEvent = {
                id: crypto.randomUUID(),
                type: "proposal",
                action: event.action ?? "",
                params: event.params ?? {},
                label: event.label ?? event.action ?? "",
                proposalId: event.proposalId,
                approved: null,
              };
              setItems((prev) => [...prev, proposal]);
            }
          } catch {
            // Malformed line — skip
          }
        }
      }

    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Something went wrong. Please try again.",
          createdAt: new Date(),
        },
      ]);
      setItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Something went wrong. Please try again.",
          createdAt: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [context]);

  const clearHistory = useCallback(async () => {
    await clearHistoryDB();
    setMessages([]);
    setItems([]);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        items,
        isLoading,
        isOpen,
        context,
        setContext,
        openChat,
        closeChat,
        sendMessage,
        clearHistory,
        updateProposal,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
