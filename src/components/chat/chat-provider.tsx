"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { getMessages, clearHistory as clearHistoryDB } from "@/lib/actions/chat";
import type { EditableField, ProposalDescriptor } from "@/lib/agent/types";

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
  fields: { label: string; value: string }[];
  proposalId?: string; // DB id from backend — used by ActionCard to resolve
  approved: boolean | null; // null = pending, true = approved, false = dismissed
  editable?: EditableField[];
};

export type ChatModuleContext = {
  route?: string;
  module?: string;
  focus?: { month: number; year: number };
  entityId?: string;
};

export type ChatItem = Message | ProposalEvent;

type NdjsonEvent = {
  type: string;
  delta?: string;
  action?: string;
  params?: Record<string, unknown>;
  label?: string;
  proposalId?: string;
  fields?: { label: string; value: string }[];
  editable?: EditableField[];
};

function buildErrorMessage(): Message {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: "Something went wrong. Please try again.",
    createdAt: new Date(),
  };
}

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
  updateProposalDescriptor: (id: string, descriptor: ProposalDescriptor) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

type StreamCallbacks = {
  assistantId: string;
  onTextDelta: (content: string) => void;
  onProposal: (proposal: ProposalEvent) => void;
};

function handleNdjsonLine(line: string, { onTextDelta, onProposal }: StreamCallbacks, textAccumRef: { current: string }) {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const event = JSON.parse(trimmed) as NdjsonEvent;
    if (event.type === "text" && event.delta) {
      textAccumRef.current += event.delta;
      onTextDelta(textAccumRef.current);
    } else if (event.type === "proposal") {
      onProposal({
        id: crypto.randomUUID(),
        type: "proposal",
        action: event.action ?? "",
        params: event.params ?? {},
        label: event.label ?? event.action ?? "",
        fields: event.fields ?? [],
        proposalId: event.proposalId,
        approved: null,
        editable: event.editable,
      });
    }
  } catch {
    // Malformed line — skip
  }
}

async function consumeChatStream(body: ReadableStream<Uint8Array>, callbacks: StreamCallbacks) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const textAccumRef = { current: "" };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep incomplete last line

    for (const line of lines) {
      handleNdjsonLine(line, callbacks, textAccumRef);
    }
  }
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside ChatProvider");
  return ctx;
}

function useProposalUpdaters(setItems: Dispatch<SetStateAction<ChatItem[]>>) {
  const updateProposal = useCallback(
    (id: string, approved: boolean) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id && "type" in item && (item as ProposalEvent).type === "proposal"
            ? { ...(item as ProposalEvent), approved }
            : item
        )
      );
    },
    [setItems]
  );

  const updateProposalDescriptor = useCallback(
    (id: string, descriptor: ProposalDescriptor) => {
      setItems((prev) =>
        prev.map((item) =>
          item.id === id && "type" in item && (item as ProposalEvent).type === "proposal"
            ? {
                ...(item as ProposalEvent),
                params: descriptor.params,
                label: descriptor.title,
                fields: descriptor.fields,
                editable: descriptor.editable,
              }
            : item
        )
      );
    },
    [setItems]
  );

  return { updateProposal, updateProposalDescriptor };
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

  const { updateProposal, updateProposalDescriptor } = useProposalUpdaters(setItems);

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

      await consumeChatStream(res.body, {
        assistantId,
        onTextDelta: (content) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content } : m))
          );
          setItems((prev) =>
            prev.map((item) =>
              item.id === assistantId ? { ...(item as Message), content } : item
            )
          );
        },
        onProposal: (proposal) => {
          setItems((prev) => [...prev, proposal]);
        },
      });
    } catch {
      const errorMsg = buildErrorMessage();
      setMessages((prev) => [...prev, errorMsg]);
      setItems((prev) => [...prev, errorMsg]);
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
        updateProposalDescriptor,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
