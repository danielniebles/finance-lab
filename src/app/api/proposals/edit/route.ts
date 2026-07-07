import { NextRequest } from "next/server";
import { applyProposalEdit } from "@/lib/agent/apply-proposal-edit";

export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json()) as {
    proposalId: string;
    field: string;
    optionId: string;
  };

  const { proposalId, field, optionId } = body;

  if (!proposalId || !field || !optionId) {
    return Response.json(
      { ok: false, message: "Missing proposalId, field, or optionId" },
      { status: 400 },
    );
  }

  const result = await applyProposalEdit(proposalId, field, optionId);

  return Response.json(result);
}
