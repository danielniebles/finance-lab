import { NextRequest } from "next/server";
import {
  toggleBatchItem,
  setBatchItemCategory,
  setBatchCardLabel,
} from "@/lib/agent/apply-batch-edit";

// POST /api/proposals/batch-edit — the web counterpart to Telegram's
// bt:/bs:/bc: callbacks (ADR-034). Mirrors POST /api/proposals/edit's shape:
// one route, a discriminated `op` field selecting which of the three shared
// apply-batch-edit.ts mutations to run, since a batch has three distinct edit
// shapes (toggle an item, set an item's category, set the batch card label)
// where the single-field /api/proposals/edit shape doesn't fit.
//
// Body shapes:
//   { proposalId, op: "toggle", itemIdx }
//   { proposalId, op: "setCategory", itemIdx, optionIdx }
//   { proposalId, op: "setCardLabel", optionIdx }
// Response: { ok, descriptor?, message? } — same as /api/proposals/edit.

type BatchEditBody =
  | { proposalId: string; op: "toggle"; itemIdx: number }
  | { proposalId: string; op: "setCategory"; itemIdx: number; optionIdx: number }
  | { proposalId: string; op: "setCardLabel"; optionIdx: number };

export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json()) as Partial<BatchEditBody>;
  const { proposalId, op } = body;

  if (!proposalId || !op) {
    return Response.json(
      { ok: false, message: "Missing proposalId or op" },
      { status: 400 },
    );
  }

  if (op === "toggle") {
    const { itemIdx } = body as { itemIdx?: number };
    if (itemIdx == null) {
      return Response.json({ ok: false, message: "Missing itemIdx" }, { status: 400 });
    }
    return Response.json(await toggleBatchItem(proposalId, itemIdx));
  }

  if (op === "setCategory") {
    const { itemIdx, optionIdx } = body as { itemIdx?: number; optionIdx?: number };
    if (itemIdx == null || optionIdx == null) {
      return Response.json({ ok: false, message: "Missing itemIdx or optionIdx" }, { status: 400 });
    }
    return Response.json(await setBatchItemCategory(proposalId, itemIdx, optionIdx));
  }

  if (op === "setCardLabel") {
    const { optionIdx } = body as { optionIdx?: number };
    if (optionIdx == null) {
      return Response.json({ ok: false, message: "Missing optionIdx" }, { status: 400 });
    }
    return Response.json(await setBatchCardLabel(proposalId, optionIdx));
  }

  return Response.json({ ok: false, message: `Unknown op: ${op}` }, { status: 400 });
}
