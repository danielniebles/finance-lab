import { NextRequest } from "next/server";
import { resolveProposal } from "@/lib/agent/execute-proposal";

export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json()) as {
    proposalId: string;
    choiceId: "approve" | "dismiss";
  };

  const { proposalId, choiceId } = body;

  if (!proposalId || !choiceId) {
    return Response.json({ ok: false, message: "Missing proposalId or choiceId" }, { status: 400 });
  }

  const result = await resolveProposal({ proposalId, choiceId });

  return Response.json(result);
}
