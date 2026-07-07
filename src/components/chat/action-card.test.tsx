// Component test for ADR-031 editable proposal cards (Part 5.3 — web rendering).
// Covers: a proposal with `editable` renders a <select> defaulting to `selectedId`
// with `options`; changing it POSTs to /api/proposals/edit and, on success, calls
// updateProposalDescriptor with the returned descriptor; on failure it surfaces the
// error and does not call the updater. Also covers the `__other__` sentinel (no
// endpoint call, inline hint shown) and that a normal (non-editable) proposal still
// renders/approves/dismisses as before.

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionCard } from "./action-card";
import type { ProposalEvent } from "./chat-provider";

const routerRefreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefreshMock }),
}));

const updateProposalMock = vi.fn();
const updateProposalDescriptorMock = vi.fn();
vi.mock("./chat-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./chat-provider")>();
  return {
    ...actual,
    useChat: () => ({
      updateProposal: updateProposalMock,
      updateProposalDescriptor: updateProposalDescriptorMock,
    }),
  };
});

function makeProposal(overrides: Partial<ProposalEvent> = {}): ProposalEvent {
  return {
    id: "local-1",
    type: "proposal",
    action: "propose_add_transaction",
    params: { amount: -11_956, appCategoryId: "cat-transport" },
    label: "Add transaction: -11,956 COP",
    fields: [{ label: "Amount", value: "-11,956 COP" }],
    proposalId: "proposal-db-1",
    approved: null,
    ...overrides,
  };
}

const EDITABLE_FIELD = {
  field: "appCategoryId",
  label: "Categoría",
  selectedId: "cat-transport",
  options: [
    { id: "cat-transport", label: "Transport" },
    { id: "cat-going-out", label: "Going Out" },
    { id: "__other__", label: "Otra…" },
  ],
};

const originalAlert = window.alert;
const originalFetch = global.fetch;

beforeEach(() => {
  vi.resetAllMocks();
  window.alert = vi.fn();
  global.fetch = vi.fn();
});

afterAll(() => {
  window.alert = originalAlert;
  global.fetch = originalFetch;
});

describe("ActionCard — normal (non-editable) proposal", () => {
  it("renders fields and approve/dismiss without any select", () => {
    render(<ActionCard proposal={makeProposal()} />);

    expect(screen.getByText("Add transaction: -11,956 COP")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("dismiss calls updateProposal(id, false)", async () => {
    const user = userEvent.setup();
    render(<ActionCard proposal={makeProposal()} />);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(updateProposalMock).toHaveBeenCalledWith("local-1", false);
  });
});

describe("ActionCard — editable field", () => {
  it("renders a select defaulting to selectedId with the given options", () => {
    render(<ActionCard proposal={makeProposal({ editable: [EDITABLE_FIELD] })} />);

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(select).toHaveTextContent("cat-transport");
  });

  it("posts to /api/proposals/edit on a real option change and applies the returned descriptor", async () => {
    const newDescriptor = {
      id: "proposal-db-1",
      action: "propose_add_transaction",
      params: { amount: -11_956, appCategoryId: "cat-going-out" },
      title: "Add transaction: -11,956 COP (Going Out)",
      fields: [{ label: "Amount", value: "-11,956 COP" }],
      reasoning: "",
      choices: [],
      editable: [{ ...EDITABLE_FIELD, selectedId: "cat-going-out" }],
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ ok: true, descriptor: newDescriptor }),
    });

    const user = userEvent.setup();
    render(<ActionCard proposal={makeProposal({ editable: [EDITABLE_FIELD] })} />);

    const select = screen.getByRole("combobox");
    await user.click(select);
    await user.click(await screen.findByRole("option", { name: "Going Out" }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/proposals/edit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          proposalId: "proposal-db-1",
          field: "appCategoryId",
          optionId: "cat-going-out",
        }),
      })
    );
    expect(updateProposalDescriptorMock).toHaveBeenCalledWith("local-1", newDescriptor);
  });

  it("surfaces the error message and does not call the updater on failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: async () => ({ ok: false, message: "Proposal is already approved." }),
    });

    const user = userEvent.setup();
    render(<ActionCard proposal={makeProposal({ editable: [EDITABLE_FIELD] })} />);

    const select = screen.getByRole("combobox");
    await user.click(select);
    await user.click(await screen.findByRole("option", { name: "Going Out" }));

    expect(updateProposalDescriptorMock).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining("Proposal is already approved.")
    );
  });

  it("selecting the __other__ sentinel does not call the edit endpoint and shows the chat hint", async () => {
    const user = userEvent.setup();
    render(<ActionCard proposal={makeProposal({ editable: [EDITABLE_FIELD] })} />);

    const select = screen.getByRole("combobox");
    await user.click(select);
    await user.click(await screen.findByRole("option", { name: "Otra…" }));

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByText("Escribe la categoría en el chat.")).toBeInTheDocument();
  });
});
