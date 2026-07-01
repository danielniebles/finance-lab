import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  createVault,
  updateVault,
  addVaultEntry,
  archiveVault,
} from "@/lib/actions/vaults";
import { createRecurringExpense, payRecurringExpense } from "@/lib/actions/recurring";
import {
  createInstallment,
  createCard,
  unmarkPaymentBySlot,
} from "@/lib/actions/installments";
import {
  createDebtor,
  createLoan,
  recordLoanPayment,
} from "@/lib/actions/loans";
import { importFromDrive } from "@/lib/actions/drive";
import { markPayment } from "@/lib/actions/installments";
import type { VaultKind, VaultGoalType, BatchStatus } from "@/generated/prisma";

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

      // ── Drive import ───────────────────────────────────────────────────────
      case "importFromDrive": {
        const { fileId, fileName, status } = params as {
          fileId: string;
          fileName: string;
          status?: string;
        };
        await importFromDrive(fileId, fileName, (status as BatchStatus) ?? undefined);
        break;
      }

      // ── Installment tools ──────────────────────────────────────────────────
      case "createInstallment": {
        const { createCard: newCard, cardId: resolvedCardId, ...installmentParams } = params;
        let cardId = resolvedCardId as string | null | undefined;

        if (newCard) {
          const card = await createCard({ name: (newCard as { name: string }).name });
          cardId = card.id;
          // Store createdCardId for potential undo
          await db.pendingProposal.update({
            where: { id: proposalId },
            data: { params: { ...params, cardId, createdCardId: card.id } as unknown as Record<string, string> },
          });
        }

        const created = await createInstallment({
          description: installmentParams.description as string,
          totalAmount: Number(installmentParams.totalAmount),
          numInstallments: Number(installmentParams.numInstallments),
          monthlyInterestRate: installmentParams.monthlyInterestRate != null
            ? Number(installmentParams.monthlyInterestRate)
            : null,
          startDate: new Date(installmentParams.startDate as string),
          notes: installmentParams.notes as string | undefined,
          cardId: cardId ?? null,
          debtorId: installmentParams.debtorId as string | null | undefined,
          fundingAccountId: installmentParams.fundingAccountId as string | null | undefined,
        });

        // Store createdId for undo
        await db.pendingProposal.update({
          where: { id: proposalId },
          data: { params: { ...params, cardId, createdId: created.id } as unknown as Record<string, string> },
        });
        break;
      }

      case "markPayment": {
        const result = await markPayment(
          params.installmentId as string,
          Number(params.installmentNum),
          params.paidAt ? new Date(params.paidAt as string) : new Date(),
        );
        // Store installmentNum for undo (unmarkPaymentBySlot needs it)
        await db.pendingProposal.update({
          where: { id: proposalId },
          data: { params: { ...params, createdId: `${params.installmentId}:${params.installmentNum}` } as unknown as Record<string, string> },
        });
        // Revalidate loans if a loan was auto-created
        if (result.loanCreated) revalidatePath("/loans");
        break;
      }

      // ── Loan tools ────────────────────────────────────────────────────────
      case "createLoan": {
        const { createDebtor: newDebtor, debtorId: resolvedDebtorId, ...loanParams } = params;
        let debtorId = resolvedDebtorId as string | null | undefined;

        if (newDebtor) {
          const debtor = await createDebtor({ name: (newDebtor as { name: string }).name });
          debtorId = debtor.id;
          // Store createdDebtorId for potential cascade undo
          await db.pendingProposal.update({
            where: { id: proposalId },
            data: { params: { ...params, debtorId, createdDebtorId: debtor.id } as unknown as Record<string, string> },
          });
        }

        const created = await createLoan({
          debtorId: debtorId as string,
          accountId: loanParams.accountId as string,
          amount: Number(loanParams.amount),
          date: new Date(loanParams.date as string),
          expectedBy: loanParams.expectedBy ? new Date(loanParams.expectedBy as string) : undefined,
          notes: loanParams.notes as string | undefined,
        });

        await db.pendingProposal.update({
          where: { id: proposalId },
          data: { params: { ...params, debtorId, createdId: created.id } as unknown as Record<string, string> },
        });
        break;
      }

      case "recordPayment": {
        const created = await recordLoanPayment({
          loanId: params.loanId as string,
          amount: Number(params.amount),
          date: params.date ? new Date(params.date as string) : new Date(),
          notes: params.notes as string | undefined,
        });

        await db.pendingProposal.update({
          where: { id: proposalId },
          data: { params: { ...params, createdId: created.id } as unknown as Record<string, string> },
        });
        break;
      }

      // ── Undo ──────────────────────────────────────────────────────────────
      case "undoProposal": {
        const { targetProposalId, originalAction } = params as {
          targetProposalId: string;
          originalAction: string;
        };

        const target = await db.pendingProposal.findUniqueOrThrow({
          where: { id: targetProposalId },
        });
        const targetParams = target.params as Record<string, unknown>;

        switch (originalAction) {
          case "createInstallment":
            if (!targetParams.createdId) throw new Error("Cannot undo: createdId not recorded.");
            await db.installment.delete({ where: { id: targetParams.createdId as string } });
            break;
          case "markPayment":
            await unmarkPaymentBySlot(
              targetParams.installmentId as string,
              Number(targetParams.installmentNum),
            );
            break;
          case "createLoan":
            if (!targetParams.createdId) throw new Error("Cannot undo: createdId not recorded.");
            await db.loan.delete({ where: { id: targetParams.createdId as string } });
            if (targetParams.createdDebtorId) {
              const debtorLoanCount = await db.loan.count({
                where: { debtorId: targetParams.createdDebtorId as string },
              });
              if (debtorLoanCount === 0) {
                await db.debtor.delete({ where: { id: targetParams.createdDebtorId as string } });
              }
            }
            break;
          case "recordPayment":
            if (!targetParams.createdId) throw new Error("Cannot undo: createdId not recorded.");
            await db.loanPayment.delete({ where: { id: targetParams.createdId as string } });
            break;
          case "createDebtor": {
            if (!targetParams.createdId) throw new Error("Cannot undo: createdId not recorded.");
            const debtorLoanCount = await db.loan.count({
              where: { debtorId: targetParams.createdId as string },
            });
            if (debtorLoanCount > 0) throw new Error("Cannot undo debtor creation — they have loans.");
            await db.debtor.delete({ where: { id: targetParams.createdId as string } });
            break;
          }
          case "createCard": {
            if (!targetParams.createdId) throw new Error("Cannot undo: createdId not recorded.");
            const cardInstallmentCount = await db.installment.count({
              where: { cardId: targetParams.createdId as string },
            });
            if (cardInstallmentCount > 0) throw new Error("Cannot undo card creation — it has installments.");
            await db.creditCard.delete({ where: { id: targetParams.createdId as string } });
            break;
          }
          default:
            throw new Error(`No undo handler for action: ${originalAction}`);
        }

        // Mark the original proposal as undone
        await db.pendingProposal.update({
          where: { id: targetProposalId },
          data: { status: "undone" },
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
    revalidatePath("/installments");
    revalidatePath("/expenses");

    return { ok: true, message: "Approved" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, message };
  }
}
