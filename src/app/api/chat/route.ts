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

  // Persist user message and fetch history in parallel. Fetch the most
  // RECENT 20 (desc + take), then reverse to chronological order — avoids
  // loading the whole table just to slice the tail (ADR-029; mirrors
  // deliver-to-telegram.ts's loadHistoryWithIncoming).
  const [, historyRows] = await Promise.all([
    saveMessage("user", content),
    db.chatMessage.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const history = historyRows.reverse().map((m) => ({
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

        // Emit each proposal as an NDJSON event (includes proposalId for frontend resolve).
        // `editable` (ADR-031) is included so a following Frontend pass can render it as
        // a <select> — omitted entirely (undefined) for the vast majority of proposals
        // that don't set it, so existing NDJSON payload shape is otherwise unchanged.
        // `batch` (ADR-034) follows the same story for propose_add_transactions_batch.
        for (const p of result.proposals) {
          write({
            type: "proposal",
            proposalId: p.id,
            action: p.action,
            params: p.params,
            label: p.title,
            fields: p.fields,
            editable: p.editable,
            batch: p.batch,
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
