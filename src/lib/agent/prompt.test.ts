// @vitest-environment node
//
// No existing test convention for prompt.ts prior to this pass — per the
// handoff, a simple string-contains assertion is enough for prose, no test
// infra needed. Covers the ADR-033 additions: the "transfer ≠ self-transfer"
// rule and the counterparty-field extraction instruction.

import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./prompt";

describe("buildSystemPrompt — counterparty rules (ADR-033)", () => {
  const prompt = buildSystemPrompt({ now: new Date("2026-07-06") });

  it("states that a transfer to a named account is a payment, not a self-transfer", () => {
    expect(prompt).toContain("not a self-transfer");
  });

  it("instructs extracting counterparty fields for propose_add_transaction", () => {
    expect(prompt).toContain("counterpartyAccount");
    expect(prompt).toContain("counterpartyMerchant");
    expect(prompt).toContain("counterpartySender");
  });

  it("tells the model it does not need to call get_counterparty_rules itself", () => {
    expect(prompt).toContain("consulted automatically");
  });
});
