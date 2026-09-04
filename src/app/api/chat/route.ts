import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { saveMessage } from "@/lib/actions/chat";
import { runAgentTurn } from "@/lib/agent/run-agent-turn";
import { isReplayableEventContent, EVENT_ROLE, type ChatRole } from "@/lib/agent/events";
import { saveAssistantTurn } from "@/lib/agent/deliver-to-telegram";
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

  const history = historyRows
    .reverse()
    // Event rows are the system's record of what actually happened; they are
    // replayed as observations, not as the model's own speech (agent/events.ts).
    // `unbacked_claim` rows quote phantom prose and are never replayed.
    .filter((m) => m.role !== EVENT_ROLE || isReplayableEventContent(m.content))
    .map((m) => ({
      role: m.role as ChatRole,
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

        // Persist the assistant text plus an event row per proposal, so a turn
        // that only proposed (no text) still threads into the shared history
        // the next Telegram/web turn reads back. Shared with the Telegram path
        // rather than reimplemented — this route used to build its own
        // "[Proposed: …]" summary string, a second copy of the same
        // system-text-as-assistant-speech defect (agent/events.ts).
        await saveAssistantTurn(result.text, result.proposals, "web", result.autoRecorded ?? []);

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
