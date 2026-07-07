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

describe("buildSystemPrompt — card-screenshot batch ingestion (ADR-034)", () => {
  const prompt = buildSystemPrompt({ now: new Date("2026-07-06") });

  it("instructs extracting every row with vendor/amount/date on a card-statement screenshot", () => {
    expect(prompt).toContain("propose_add_transactions_batch");
    expect(prompt).toContain("vendor, amount, date");
  });

  it("instructs marking scratched/crossed-out rows best-effort", () => {
    expect(prompt).toContain("scratched: true");
  });

  it("states card purchases are always expenses (positive magnitude for this tool)", () => {
    expect(prompt).toContain("Card purchases are always expenses");
  });

  it("instructs exactly one batch call, no per-row questions", () => {
    expect(prompt).toContain("exactly ONE propose_add_transactions_batch call");
    expect(prompt).toContain("Do not ask per-row clarifying questions");
  });
});
