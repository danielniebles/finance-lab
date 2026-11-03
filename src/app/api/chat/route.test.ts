// @vitest-environment node
//
// Regression: the web chat route used to save the user message and read
// history in parallel. When the read won, the live question was missing from
// history and the model replied to the previous ⟦event⟧ line instead
// ("Got it! Let me know if there's anything else…", production 2026-11-03).

import { describe, it, expect, vi } from "vitest";

const priorRows = [
  { role: "user", content: "Payment of $130.400,00 processed." },
  { role: "assistant", content: "Recorded automatically per your rule just now." },
  { role: "event", content: "⟦event⟧ auto_recorded proposal=p1 txn=t1" },
];

vi.mock("@/lib/db", () => ({
  db: {
    // Rows come back newest-first (desc + take); the live message is NOT here.
    chatMessage: { findMany: vi.fn(async () => [...priorRows].reverse()) },
  },
}));

vi.mock("@/lib/actions/chat", () => ({
  saveMessage: vi.fn().mockResolvedValue(undefined),
}));

const runAgentTurnMock = vi.fn().mockResolvedValue({ text: "ok", proposals: [], autoRecorded: [] });
vi.mock("@/lib/agent/run-agent-turn", () => ({
  runAgentTurn: (...args: unknown[]) => runAgentTurnMock(...args),
}));

import { POST } from "./route";

describe("POST /api/chat", () => {
  it("always ends the agent history with the live user message", async () => {
    const question = "how is this day compared to last month?";
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ content: question }),
    });

    const res = await POST(req as never);
    await res.text();

    const { messages } = runAgentTurnMock.mock.calls[0][0] as {
      messages: { role: string; content: string }[];
    };
    expect(messages.at(-1)).toEqual({ role: "user", content: question });
    expect(messages.filter((m) => m.content === question)).toHaveLength(1);
  });
});
