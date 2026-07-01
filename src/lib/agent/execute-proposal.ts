import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  createVault,
  updateVault,
  addVaultEntry,
  archiveVault,
} from "@/lib/actions/vaults";
import { createRecurringExpense, payRecurringExpense } from "@/lib/actions/recurring";
import type { VaultKind, VaultGoalType } from "@/generated/prisma";

export type ProposalDecision = {
  proposalId: string;
  choiceId: "approve" | "dismiss";
};

export async function resolveProposal(
  d: ProposalDecision,
): Promise<{ ok: boolean; message: string }> {
  const { proposalId, choiceId } = d;

  const proposal = await db.pendingProposal.findUnique({
    where: { id: proposalId },
  });

  if (!proposal) {
    return { ok: false, message: "Proposal not found." };
  }
  if (proposal.status !== "pending") {
    return { ok: false, message: `Proposal is already ${proposal.status}.` };
  }

  if (choiceId === "dismiss") {
    await db.pendingProposal.update({
      where: { id: proposalId },
      data: { status: "dismissed", resolvedAt: new Date() },
    });
    return { ok: true, message: "Dismissed" };
  }

  // choiceId === "approve" — run the action map
  const params = proposal.params as Record<string, unknown>;

  try {
    switch (proposal.action) {
      case "propose_create_vault": {
        await createVault({
          name: params.name as string,
          kind: (params.kind as VaultKind | undefined) ?? "LEISURE",
          goalType: params.goalType as VaultGoalType,
          targetAmount: params.targetAmount != null ? Number(params.targetAmount) : null,
          targetDate:
            params.targetDate != null
              ? new Date(params.targetDate as string)
              : null,
        });
        break;
      }
      case "propose_update_vault": {
        const { vaultId, ...fields } = params;
        await updateVault(vaultId as string, {
          name: fields.name as string | undefined,
          kind: fields.kind as VaultKind | undefined,
          goalType: fields.goalType as VaultGoalType | undefined,
          targetAmount:
            "targetAmount" in fields
              ? fields.targetAmount != null
                ? Number(fields.targetAmount)
                : null
              : undefined,
          targetDate:
            "targetDate" in fields
              ? fields.targetDate != null
                ? new Date(fields.targetDate as string)
                : null
              : undefined,
          color: fields.color as string | undefined,
          notes: fields.notes as string | undefined,
        });
        break;
      }
      case "propose_vault_contribution": {
        await addVaultEntry(
          params.vaultId as string,
          Number(params.amount),
          params.date != null ? new Date(params.date as string) : undefined,
          params.notes as string | undefined,
          (params.sourceAccountId as string | undefined) ?? null,
        );
        break;
      }
      case "propose_vault_withdrawal": {
        await addVaultEntry(
          params.vaultId as string,
          -Number(params.amount),
          params.date != null ? new Date(params.date as string) : undefined,
          params.notes as string | undefined,
          (params.sourceAccountId as string | undefined) ?? null,
        );
        break;
      }
      case "propose_archive_vault": {
        await archiveVault(params.vaultId as string);
        break;
      }
      case "propose_create_recurring_expense": {
        await createRecurringExpense({
          name: params.name as string,
          estimatedAmount: Number(params.estimatedAmount),
          cadenceMonths: Number(params.cadenceMonths),
          nextDueDate: new Date(params.nextDueDate as string),
          category: (params.category as string | undefined) ?? null,
          fundingVaultId: (params.fundingVaultId as string | undefined) ?? null,
        });
        break;
      }
      case "propose_pay_recurring": {
        await payRecurringExpense(params.id as string, {
          amount: Number(params.amount),
          fromVaultId: params.fromVaultId as string | undefined,
        });
        break;
      }
      default:
        throw new Error(`No handler for action: ${proposal.action}`);
    }

    await db.pendingProposal.update({
      where: { id: proposalId },
      data: { status: "approved", resolvedAt: new Date() },
    });

    revalidatePath("/vaults");
    revalidatePath("/overview");
    revalidatePath("/loans");

    return { ok: true, message: "Approved" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, message };
  }
}
