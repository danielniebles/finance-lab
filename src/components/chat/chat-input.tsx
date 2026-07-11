"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { SendHorizonal, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChatInput({
  onSend,
  disabled,
  hasHistory = false,
  onUndo,
}: {
  onSend: (content: string) => void;
  disabled: boolean;
  hasHistory?: boolean;
  onUndo?: () => void;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  return (
    <div className="border-t border-border">
      {hasHistory && onUndo && (
        <div className="flex justify-start px-3 pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onUndo}
            disabled={disabled}
            aria-label="Undo last action"
          >
            <Undo2 className="size-3.5" aria-hidden="true" />
            Undo last
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2 p-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Ask about your finances…"
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground min-h-8 max-h-30 leading-relaxed"
          disabled={disabled}
        />
        <Button
          size="icon"
          className="size-8 shrink-0"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
        >
          <SendHorizonal className="size-5" />
        </Button>
      </div>
    </div>
  );
}
