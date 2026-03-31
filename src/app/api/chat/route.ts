// ⚠️  MOCK — Phase 2 placeholder. No tokens are spent here.
// Replace this file contents in Phase 4 to wire Claude.

export async function POST(req: Request) {
  const { content } = await req.json();

  const reply = `[Mock] You said: "${content}". Claude integration comes in Phase 4.`;

  // Stream the reply back character by character to exercise the streaming UI
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const char of reply) {
        controller.enqueue(encoder.encode(char));
        await new Promise((r) => setTimeout(r, 18));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
