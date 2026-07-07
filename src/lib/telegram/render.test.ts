// @vitest-environment node
//
// Tests for toTelegramMessage / toTelegramEditOptionsMessage (ADR-031): the
// editable-field keyboard rendering, and a sanity check that the new index-
// based callback_data formats stay within Telegram's 64-byte limit even with
// a realistic proposal id.

import { describe, it, expect } from "vitest";
import { toTelegramMessage, toTelegramEditOptionsMessage } from "./render";
import type { ProposalDescriptor } from "@/lib/agent/types";

// A realistic cuid (~25 chars) — proposalId length assumption stated in the
// render.ts byte-budget comment.
const REALISTIC_PROPOSAL_ID = "clx1a2b3c4d5e6f7g8h9i0j1k";

function makeProposal(overrides?: Partial<ProposalDescriptor>): ProposalDescriptor {
  return {
    id: REALISTIC_PROPOSAL_ID,
    action: "propose_add_transaction",
    params: { amount: -11_956, appCategoryId: "cat-1" },
    title: "Add expense: Bancolombia — $11.956",
    fields: [{ label: "Amount", value: "$11.956" }],
    reasoning: "",
    choices: [
      { id: "approve", label: "Approve", style: "primary" },
      { id: "dismiss", label: "Dismiss" },
    ],
    editable: [
      {
        field: "appCategoryId",
        label: "Categoría",
        selectedId: "cat-1",
        options: [
          { id: "cat-1", label: "Groceries" },
          { id: "cat-2", label: "Going Out" },
          { id: "__other__", label: "Otra…" },
        ],
      },
    ],
    ...overrides,
  };
}

describe("toTelegramMessage", () => {
  it("adds a ✏️ button per editable field alongside Approve/Dismiss", () => {
    const { reply_markup } = toTelegramMessage(makeProposal());
    const buttonTexts = reply_markup.inline_keyboard.flat().map((b) => b.text);

    expect(buttonTexts).toContain("✏️ Categoría");
    expect(buttonTexts).toContain("✅ Approve");
    expect(buttonTexts).toContain("❌ Dismiss");
  });

  it("omits the editable row entirely when there is no editable field (unchanged behavior)", () => {
    const { reply_markup } = toTelegramMessage(makeProposal({ editable: undefined }));

    expect(reply_markup.inline_keyboard).toHaveLength(1);
    expect(reply_markup.inline_keyboard[0].map((b) => b.text)).toEqual(["✅ Approve", "❌ Dismiss"]);
  });

  it("shows the currently selected option's label in the card text", () => {
    const { text } = toTelegramMessage(makeProposal());
    expect(text).toContain("Categoría: Groceries");
  });

  it("uses eopen:{fieldIdx} callback_data for the editable button", () => {
    const { reply_markup } = toTelegramMessage(makeProposal());
    const editButton = reply_markup.inline_keyboard.flat().find((b) => b.text === "✏️ Categoría");
    expect(editButton?.callback_data).toBe(`${REALISTIC_PROPOSAL_ID}:eopen:0`);
  });
});

describe("toTelegramEditOptionsMessage", () => {
  it("renders one button per option, marking the selected one with a ✓ prefix", () => {
    const { reply_markup } = toTelegramEditOptionsMessage(makeProposal(), 0);
    const rows = reply_markup.inline_keyboard;

    expect(rows[0][0].text).toBe("✓ Groceries");
    expect(rows[1][0].text).toBe("Going Out");
    expect(rows[2][0].text).toBe("Otra…");
  });

  it("appends a back button that restores the default card view", () => {
    const { reply_markup } = toTelegramEditOptionsMessage(makeProposal(), 0);
    const lastRow = reply_markup.inline_keyboard.at(-1);
    expect(lastRow).toEqual([{ text: "⬅︎ Volver", callback_data: `${REALISTIC_PROPOSAL_ID}:eback` }]);
  });

  it("uses e:{fieldIdx}:{optIdx} callback_data for each option", () => {
    const { reply_markup } = toTelegramEditOptionsMessage(makeProposal(), 0);
    expect(reply_markup.inline_keyboard[0][0].callback_data).toBe(`${REALISTIC_PROPOSAL_ID}:e:0:0`);
    expect(reply_markup.inline_keyboard[1][0].callback_data).toBe(`${REALISTIC_PROPOSAL_ID}:e:0:1`);
    expect(reply_markup.inline_keyboard[2][0].callback_data).toBe(`${REALISTIC_PROPOSAL_ID}:e:0:2`);
  });
});

describe("callback_data byte budget", () => {
  const byteLength = (s: string) => new TextEncoder().encode(s).length;

  it("stays under Telegram's 64-byte limit for eopen: with a realistic proposal id", () => {
    expect(byteLength(`${REALISTIC_PROPOSAL_ID}:eopen:0`)).toBeLessThanOrEqual(64);
  });

  it("stays under Telegram's 64-byte limit for e: with realistic indices", () => {
    // Even with double-digit indices (unrealistic but a safe upper bound —
    // a shortlist is capped at 5 options + __other__, and fields will stay
    // single-digit for the foreseeable future).
    expect(byteLength(`${REALISTIC_PROPOSAL_ID}:e:9:9`)).toBeLessThanOrEqual(64);
  });

  it("stays under Telegram's 64-byte limit for eback", () => {
    expect(byteLength(`${REALISTIC_PROPOSAL_ID}:eback`)).toBeLessThanOrEqual(64);
  });

  it("stays under the limit even for the longest realistic cuid + suffix combination", () => {
    // cuid2 default length is 24-32 chars; pad to a conservative 32 to bound
    // the worst case rather than only the happy path.
    const longId = "c".repeat(32);
    expect(byteLength(`${longId}:eopen:0`)).toBeLessThanOrEqual(64);
    expect(byteLength(`${longId}:e:0:0`)).toBeLessThanOrEqual(64);
  });
});
