// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/actions/chat", () => ({
  saveMessage: vi.fn().mockResolvedValue(undefined),
}));

import { saveMessage } from "@/lib/actions/chat";
import {
  formatEvent,
  isReplayableEventContent,
  logEvent,
  EVENT_PREFIX,
  EVENT_ROLE,
} from "./events";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("formatEvent", () => {
  it("renders name and fields as a single prefixed line", () => {
    expect(formatEvent("proposal_created", { id: "p1", action: "propose_add_transaction" })).toBe(
      `${EVENT_PREFIX} proposal_created id=p1 action=propose_add_transaction`,
    );
  });

  it("quotes values containing whitespace so the line stays parseable", () => {
    expect(formatEvent("proposal_created", { title: "Add expense: Debit" })).toBe(
      `${EVENT_PREFIX} proposal_created title="Add expense: Debit"`,
    );
  });

  it("keeps multi-line values on one line", () => {
    const line = formatEvent("unbacked_claim", { text: "Drafted for your approval\n\n— $11.199" });
    expect(line.split("\n")).toHaveLength(1);
    expect(line).toContain("\\n");
  });

  it("omits null, undefined and empty-string fields", () => {
    expect(formatEvent("rule_offer", { matchValue: "UBER", wallet: "", tags: null })).toBe(
      `${EVENT_PREFIX} rule_offer matchValue=UBER`,
    );
  });

  it("renders booleans and numbers unquoted", () => {
    expect(formatEvent("unbacked_claim", { retried: true, recovered: false })).toBe(
      `${EVENT_PREFIX} unbacked_claim retried=true recovered=false`,
    );
  });

  it("renders a bare event with no fields", () => {
    expect(formatEvent("proposal_dismissed")).toBe(`${EVENT_PREFIX} proposal_dismissed`);
  });
});

// The whole point of the event log is that action-claiming prose never gets
// replayed to the model as history. `unbacked_claim` rows quote exactly that
// prose for the audit trail, so they must be the one event kept out of the
// replay — feeding them back would reintroduce the defect being fixed.
describe("isReplayableEventContent", () => {
  it("excludes unbacked_claim rows from replay", () => {
    const row = formatEvent("unbacked_claim", { text: "Drafted for your approval — $11.199" });
    expect(isReplayableEventContent(row)).toBe(false);
  });

  it("replays every other event kind", () => {
    for (const row of [
      formatEvent("proposal_created", { id: "p1" }),
      formatEvent("proposal_approved", { id: "p1" }),
      formatEvent("proposal_dismissed", { id: "p1" }),
      formatEvent("auto_recorded", { txn: "t1" }),
      formatEvent("rule_offer", { matchValue: "UBER*RIDES" }),
    ]) {
      expect(isReplayableEventContent(row)).toBe(true);
    }
  });
});

describe("logEvent", () => {
  it("persists the formatted line under the event role", async () => {
    await logEvent("proposal_approved", { id: "p1" }, "telegram");

    expect(saveMessage).toHaveBeenCalledWith(
      EVENT_ROLE,
      `${EVENT_PREFIX} proposal_approved id=p1`,
      "telegram",
    );
  });

  // The underlying action has already happened by the time an event is
  // written, so a failed log write must never surface as a failed approval.
  it("never throws when the write fails", async () => {
    vi.mocked(saveMessage).mockRejectedValueOnce(new Error("db down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(logEvent("proposal_approved", { id: "p1" })).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
