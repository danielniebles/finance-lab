// ⚠️  Phase 4 — tokens are spent from here on.
// Model: claude-haiku-4-5 (cheapest, ~$0.004/message at typical usage)

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { saveMessage } from "@/lib/actions/chat";
import { getFinancialSnapshot } from "@/lib/queries/chat";

const anthropic = new Anthropic();

const SYSTEM_PROMPT_PREFIX = `You are a personal financial advisor embedded in a finance tracking app.
The user is a single person living in Colombia. All amounts are in Colombian Pesos (COP).
You have access to their real financial data below — use it to give specific, grounded advice.
Be concise and direct. Avoid generic disclaimers.
Respond in the same language the user writes in (Spanish or English).
When recommending whether to make a purchase, factor in their current savings rate, variable burn rate, and available liquidity.`;

export async function POST(req: Request) {
  const { content } = await req.json() as { content: string };

  // Persist user message and fetch context in parallel
  const [, snapshot, history] = await Promise.all([
    saveMessage("user", content),
    getFinancialSnapshot(),
    db.chatMessage.findMany({
      orderBy: { createdAt: "asc" },
      // Last 20 messages — enough context without blowing up token count
      // The user message we just saved is included since saveMessage ran first
    }).then((rows) => rows.slice(-20)),
  ]);

  const systemPrompt = `${SYSTEM_PROMPT_PREFIX}\n\n${snapshot}`;

  // Build message array for Claude from DB history
  // History already includes the user message we just saved
  const messages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Stream from Claude
  const stream = anthropic.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  });

  // Forward each text chunk to the client while accumulating the full response
  const encoder = new TextEncoder();
  let fullResponse = "";

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const text = chunk.delta.text;
            fullResponse += text;
            controller.enqueue(encoder.encode(text));
          }
        }
        // Persist the complete assistant message once streaming finishes
        await saveMessage("assistant", fullResponse);
        controller.close();
      } catch (err) {
        // Propagate error to the client so the stream closes and isLoading resets
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
