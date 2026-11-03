import { NextRequest } from "next/server";
import { saveMessage } from "@/lib/actions/chat";
import { runAgentTurn } from "@/lib/agent/run-agent-turn";
import { loadHistoryWithIncoming, saveAssistantTurn } from "@/lib/agent/deliver-to-telegram";
import type { ChatModuleContext } from "@/components/chat/chat-provider";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    content: string;
    context?: ChatModuleContext;
  };
  const { content, context } = body;

  // Load history, then append the live message in memory — same path as
  // Telegram. Saving and reading in parallel used to race: when the read won,
  // the question was missing and the model answered the previous ⟦event⟧ line
  // with a bare "Got it!" (production 2026-11-03).
  const history = await loadHistoryWithIncoming(content);
  await saveMessage("user", content);

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
