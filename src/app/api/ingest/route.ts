// External text ingress — lets an authenticated external client (an iPhone
// Shortcut forwarding a bank notification) send free text to the agent. This is
// a third channel over the channel-agnostic runAgentTurn(); the reply/proposal
// is delivered to Telegram so the approve loop closes where the user already is
// (ADR-028).
//
// Required server-only env var: INGEST_SECRET — bearer token compared against
// the Authorization header. No default; must be set in the environment.

import { after, NextRequest } from "next/server";
import { runTurnAndDeliverToTelegram } from "@/lib/agent/deliver-to-telegram";

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  return token !== "" && token === process.env.INGEST_SECRET;
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();

  if (!text) {
    return new Response("Bad Request", { status: 400 });
  }

  // Acknowledge immediately; run the agent turn + Telegram delivery asynchronously
  // so the Shortcut doesn't wait on multiple model + DB round-trips.
  after(async () => {
    try {
      await runTurnAndDeliverToTelegram(text, { channel: "shortcut" });
    } catch (err) {
      console.error("[ingest/route] after() error:", err);
    }
  });

  return Response.json({ ok: true });
}
