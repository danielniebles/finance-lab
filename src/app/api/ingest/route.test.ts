// @vitest-environment node
//
// Unit tests for POST /api/ingest — auth + validation are pure request-in/
// response-out logic, directly testable without a live server. Coverage per
// ~/.claude/agents/standards/testing.md: correct bearer proceeds, wrong/missing
// bearer 401s with no side effects, missing/empty text 400s.
//
// The deferred `after()`-scheduled agent-turn-to-Telegram delivery path is NOT
// asserted end-to-end here — that's the same category of e2e gap already
// accepted for runAgentTurn() itself elsewhere in this codebase. `next/server`'s
// real `after()` throws when called outside a request scope (see
// node_modules/next/dist/server/after/after.js), so it's mocked to invoke its
// callback synchronously — good enough to prove scheduling did/didn't happen
// without needing a real Next.js request context.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const afterMock = vi.fn((cb: () => Promise<void>) => {
  void cb();
});

vi.mock("next/server", () => ({
  after: (cb: () => Promise<void>) => afterMock(cb),
}));

const runTurnAndDeliverToTelegramMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/agent/deliver-to-telegram", () => ({
  runTurnAndDeliverToTelegram: (...args: unknown[]) =>
    runTurnAndDeliverToTelegramMock(...args),
}));

import { POST } from "./route";

// Minimal stand-in for NextRequest — the handler only reads `.headers.get()`
// and `.json()`, so a lightweight object satisfies the contract without
// constructing a real Next.js request.
function makeRequest(opts: { authorization?: string; body?: unknown }): Parameters<typeof POST>[0] {
  return {
    headers: { get: (name: string) => (name === "authorization" ? opts.authorization ?? null : null) },
    json: async () => opts.body,
  } as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/ingest", () => {
  const ORIGINAL_SECRET = process.env.INGEST_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INGEST_SECRET = "correct-secret";
  });

  afterEach(() => {
    process.env.INGEST_SECRET = ORIGINAL_SECRET;
  });

  it("returns 200 { ok: true } and schedules delivery for a correct bearer + non-empty text", async () => {
    const req = makeRequest({
      authorization: "Bearer correct-secret",
      body: { text: "Compra aprobada por $45.000 en RAPPI" },
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(runTurnAndDeliverToTelegramMock).toHaveBeenCalledWith(
      "Compra aprobada por $45.000 en RAPPI",
      { channel: "shortcut" },
    );
  });

  it("returns 401 and does nothing for a missing bearer token", async () => {
    const req = makeRequest({ body: { text: "hello" } });

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(afterMock).not.toHaveBeenCalled();
    expect(runTurnAndDeliverToTelegramMock).not.toHaveBeenCalled();
  });

  it("returns 401 and does nothing for a mismatched bearer token", async () => {
    const req = makeRequest({
      authorization: "Bearer wrong-secret",
      body: { text: "hello" },
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(afterMock).not.toHaveBeenCalled();
    expect(runTurnAndDeliverToTelegramMock).not.toHaveBeenCalled();
  });

  it("returns 400 for missing text", async () => {
    const req = makeRequest({ authorization: "Bearer correct-secret", body: {} });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("returns 400 for empty text", async () => {
    const req = makeRequest({
      authorization: "Bearer correct-secret",
      body: { text: "" },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(afterMock).not.toHaveBeenCalled();
  });

  it("returns 400 for whitespace-only text", async () => {
    const req = makeRequest({
      authorization: "Bearer correct-secret",
      body: { text: "   " },
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(afterMock).not.toHaveBeenCalled();
  });
});
