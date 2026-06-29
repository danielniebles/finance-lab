"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { ActionCard } from "./action-card";
import type { ChatItem, Message, ProposalEvent } from "./chat-provider";

function isProposal(item: ChatItem): item is ProposalEvent {
  return "type" in item && (item as ProposalEvent).type === "proposal";
}

export function ChatMessages({
  items,
  isLoading,
}: {
  items: ChatItem[];
  isLoading: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-2 max-w-xs">
          <p className="text-sm font-medium">Your financial advisor</p>
          <p className="text-xs text-muted-foreground">
            Ask anything about your spending, loans, or whether a purchase
            makes sense right now.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {items.map((item) => {
        if (isProposal(item)) {
          return (
            <div key={item.id} className="flex justify-start">
              <div className="w-full max-w-[92%]">
                <ActionCard proposal={item} />
              </div>
            </div>
          );
        }

        const msg = item as Message;
        return (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm",
              )}
            >
              {msg.content ? (
                msg.role === "assistant" ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => (
                        <p className="mb-2 last:mb-0">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="mb-2 last:mb-0 pl-4 space-y-0.5 list-disc">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mb-2 last:mb-0 pl-4 space-y-0.5 list-decimal">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="leading-snug">{children}</li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                      ),
                      h3: ({ children }) => (
                        <p className="font-semibold mt-2 mb-1 first:mt-0">
                          {children}
                        </p>
                      ),
                      h4: ({ children }) => (
                        <p className="font-medium mt-2 mb-0.5 first:mt-0">
                          {children}
                        </p>
                      ),
                      code: ({ children }) => (
                        <code className="font-mono text-xs bg-black/20 rounded px-1 py-0.5">
                          {children}
                        </code>
                      ),
                      hr: () => <hr className="my-2 border-white/10" />,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )
              ) : (
                <span className="flex gap-1 items-center h-4">
                  <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                  <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                  <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </div>
          </div>
        );
      })}

      {isLoading &&
        (() => {
          const lastItem = items[items.length - 1];
          const lastIsUser =
            lastItem && !isProposal(lastItem) && (lastItem as Message).role === "user";
          return lastIsUser ? (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                <span className="flex gap-1 items-center h-4">
                  <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                  <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                  <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          ) : null;
        })()}

      <div ref={bottomRef} />
    </div>
  );
}
