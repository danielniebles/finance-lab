// Component test for the ADR-034 batch proposal table (web rendering of
// propose_add_transactions_batch's ProposalDescriptor.batch — Part 3/7 of
// .handoff/transactions-card-screenshot/HANDOFF.md). Covers: rows render
// vendor/amount/category + a checkbox reflecting `included`; toggling a
// checkbox POSTs { op: "toggle" } and applies the returned descriptor;
// changing a row's category POSTs { op: "setCategory" }; changing the card
// label POSTs { op: "setCardLabel" }; the running total only sums included
// items and updates when the descriptor changes.

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BatchProposalTable } from "./batch-proposal-table";
import type { BatchDescriptor, ProposalDescriptor } from "@/lib/agent/types";

const CAT_TRANSPORT = "cat-transport";
const CAT_GOING_OUT = "cat-going-out";

const CATEGORY_OPTIONS = [
  { id: CAT_TRANSPORT, label: "Transport" },
  { id: CAT_GOING_OUT, label: "Going Out" },
];

const CARD_LABEL_OPTIONS = [
  { id: "card-bancolombia", label: "Bancolombia" },
  { id: "card-nu", label: "Nu" },
];

const PROPOSAL_ID = "proposal-db-1";

function makeBatch(overrides: Partial<BatchDescriptor> = {}): BatchDescriptor {
  return {
    cardLabel: "Bancolombia",
    items: [
      { vendor: "Rappi", amount: 45_000, appCategoryId: CAT_GOING_OUT, included: true },
      { vendor: "Uber", amount: 12_000, appCategoryId: CAT_TRANSPORT, included: false, scratchDetected: true },
    ],
    categoryOptions: CATEGORY_OPTIONS,
    cardLabelOptions: CARD_LABEL_OPTIONS,
    ...overrides,
  };
}

function makeDescriptor(batch: BatchDescriptor): ProposalDescriptor {
  return {
    id: PROPOSAL_ID,
    action: "propose_add_transactions_batch",
    params: { batch },
    title: "Add 2 transactions",
    fields: [],
    reasoning: "",
    choices: [
      { id: "approve", label: "Approve", style: "primary" },
      { id: "dismiss", label: "Dismiss" },
    ],
    batch,
  };
}

function renderTable(onUpdated: (descriptor: ProposalDescriptor) => void, batch = makeBatch()) {
  return render(
    <BatchProposalTable
      proposalId={PROPOSAL_ID}
      batch={batch}
      disabled={false}
      onUpdated={onUpdated}
    />
  );
}

const originalFetch = global.fetch;
const originalAlert = window.alert;

beforeEach(() => {
  vi.resetAllMocks();
  global.fetch = vi.fn();
  window.alert = vi.fn();
});

afterAll(() => {
  global.fetch = originalFetch;
  window.alert = originalAlert;
});

describe("BatchProposalTable — rendering", () => {
  it("renders every row's vendor, amount, category, and included checkbox state", () => {
    renderTable(vi.fn());

    expect(screen.getByText("Rappi")).toBeInTheDocument();
    expect(screen.getByText("Uber")).toBeInTheDocument();
    expect(screen.getAllByText("$ 45.000").length).toBeGreaterThan(0);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it("shows the running total for included items only", () => {
    renderTable(vi.fn());

    // Only Rappi (45,000) is included — Uber (12,000) is excluded.
    expect(screen.getByText(/Incluidas:/)).toHaveTextContent("Incluidas: 1");
  });
});

describe("BatchProposalTable — edits", () => {
  it("toggling a checkbox posts op: toggle and applies the returned descriptor", async () => {
    const updatedBatch = makeBatch({
      items: [
        { vendor: "Rappi", amount: 45_000, appCategoryId: CAT_GOING_OUT, included: true },
        { vendor: "Uber", amount: 12_000, appCategoryId: CAT_TRANSPORT, included: true },
      ],
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ ok: true, descriptor: makeDescriptor(updatedBatch) }),
    });

    const onUpdated = vi.fn();
    const user = userEvent.setup();
    renderTable(onUpdated);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]); // re-include Uber

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/proposals/batch-edit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ proposalId: PROPOSAL_ID, op: "toggle", itemIdx: 1 }),
      })
    );
    expect(onUpdated).toHaveBeenCalledWith(makeDescriptor(updatedBatch));
  });

  it("changing a row's category posts op: setCategory with the option index", async () => {
    const updatedBatch = makeBatch({
      items: [
        { vendor: "Rappi", amount: 45_000, appCategoryId: CAT_TRANSPORT, included: true },
        { vendor: "Uber", amount: 12_000, appCategoryId: CAT_TRANSPORT, included: false, scratchDetected: true },
      ],
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ ok: true, descriptor: makeDescriptor(updatedBatch) }),
    });

    const onUpdated = vi.fn();
    const user = userEvent.setup();
    renderTable(onUpdated);

    const selects = screen.getAllByRole("combobox");
    // selects[0] is the card-label select; row selects follow.
    await user.click(selects[1]);
    await user.click(await screen.findByRole("option", { name: "Transport" }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/proposals/batch-edit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ proposalId: PROPOSAL_ID, op: "setCategory", itemIdx: 0, optionIdx: 0 }),
      })
    );
    expect(onUpdated).toHaveBeenCalledWith(makeDescriptor(updatedBatch));
  });

  it("changing the card label posts op: setCardLabel with the option index", async () => {
    const updatedBatch = makeBatch({ cardLabel: "Nu" });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ ok: true, descriptor: makeDescriptor(updatedBatch) }),
    });

    const onUpdated = vi.fn();
    const user = userEvent.setup();
    renderTable(onUpdated);

    const selects = screen.getAllByRole("combobox");
    await user.click(selects[0]);
    await user.click(await screen.findByRole("option", { name: "Nu" }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/proposals/batch-edit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ proposalId: PROPOSAL_ID, op: "setCardLabel", optionIdx: 1 }),
      })
    );
    expect(onUpdated).toHaveBeenCalledWith(makeDescriptor(updatedBatch));
  });
});

describe("BatchProposalTable — edit failures", () => {
  it("surfaces an alert and does not call onUpdated when toggle fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ ok: false, message: "Proposal is already approved." }),
    });

    const onUpdated = vi.fn();
    const user = userEvent.setup();
    renderTable(onUpdated);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);

    expect(onUpdated).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining("Proposal is already approved.")
    );
  });

  it("surfaces an alert and does not call onUpdated when setCardLabel fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ ok: false, message: "Proposal is already approved." }),
    });

    const onUpdated = vi.fn();
    const user = userEvent.setup();
    renderTable(onUpdated);

    const selects = screen.getAllByRole("combobox");
    await user.click(selects[0]);
    await user.click(await screen.findByRole("option", { name: "Nu" }));

    expect(onUpdated).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining("Proposal is already approved.")
    );
  });
});
