import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { saveMessage } from "@/lib/actions/chat";
import { runAgentTurn } from "@/lib/agent/run-agent-turn";
import type { ChatModuleContext } from "@/components/chat/chat-provider";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    content: string;
    context?: ChatModuleContext;
  };
  const { content, context } = body;

  // Persist user message and fetch history in parallel
  const [, historyRows] = await Promise.all([
    saveMessage("user", content),
    db.chatMessage.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const history = historyRows.slice(-20).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const write = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };

      try {
        const result = await runAgentTurn({
          messages: history,
          context: context ?? undefined,
          onTextDelta: (delta) => write({ type: "text", delta }),
          channel: "web",
        });

        // Emit each proposal as an NDJSON event (includes proposalId for frontend resolve)
        for (const p of result.proposals) {
          write({
            type: "proposal",
            proposalId: p.id,
            action: p.action,
            params: p.params,
            label: p.title,
            fields: p.fields,
          });
        }

        // Persist a single coherent assistant turn (text + proposal summary),
        // so a turn that only proposed (no text) still threads into the
        // shared history the next Telegram/web turn reads back.
        const proposalSummary = result.proposals
          .map((p) => `[Proposed: ${p.title} — awaiting your approval]`)
          .join("\n");
        const assistantRecord = [result.text, proposalSummary].filter(Boolean).join("\n\n");
        if (assistantRecord) {
          await saveMessage("assistant", assistantRecord);
        }

        controller.close();
      } catch (err) {
        const errorMsg = "Something went wrong. Please try again.";
        write({ type: "text", delta: errorMsg });
        await saveMessage("assistant", errorMsg).catch(() => {});
        controller.close();
        console.error("[chat/route] outer catch:", err);
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
