"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { computeMonthlyAmount } from "@/lib/installment-utils";

export async function createInstallment(data: {
  description: string;
  totalAmount: number;
  numInstallments: number;
  startDate: Date;
  notes?: string;
  annualInterestRate?: number | null;
}) {
  const monthlyAmount = computeMonthlyAmount(
    data.totalAmount,
    data.numInstallments,
    data.annualInterestRate,
  );
  await db.installment.create({
    data: {
      description: data.description,
      totalAmount: data.totalAmount,
      numInstallments: data.numInstallments,
      monthlyAmount,
      annualInterestRate: data.annualInterestRate ?? null,
      startDate: data.startDate,
      notes: data.notes ?? null,
    },
  });
  revalidatePath("/installments");
}

export async function updateInstallment(
  id: string,
  data: {
    description: string;
    totalAmount: number;
    numInstallments: number;
    startDate: Date;
    notes?: string;
    annualInterestRate?: number | null;
  }
) {
  const monthlyAmount = computeMonthlyAmount(
    data.totalAmount,
    data.numInstallments,
    data.annualInterestRate,
  );
  await db.installment.update({
    where: { id },
    data: {
      description: data.description,
      totalAmount: data.totalAmount,
      numInstallments: data.numInstallments,
      monthlyAmount,
      annualInterestRate: data.annualInterestRate ?? null,
      startDate: data.startDate,
      notes: data.notes ?? null,
    },
  });
  revalidatePath("/installments");
}

export async function deleteInstallment(id: string) {
  await db.installment.delete({ where: { id } });
  revalidatePath("/installments");
}

export async function markPayment(
  installmentId: string,
  installmentNum: number,
  paidAt: Date
) {
  await db.installmentPayment.create({
    data: { installmentId, installmentNum, paidAt },
  });
  revalidatePath("/installments");
}

export async function unmarkPayment(paymentId: string) {
  await db.installmentPayment.delete({ where: { id: paymentId } });
  revalidatePath("/installments");
}
