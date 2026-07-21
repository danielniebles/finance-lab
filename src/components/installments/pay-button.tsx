"use client";

import { useTransition } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { markPayment, unmarkPayment } from "@/lib/actions/installments";

export function PayButton({
  installmentId,
  installmentNum,
  paymentId,
  paidAt,
}: {
  installmentId: string;
  installmentNum: number;
  paymentId: string | null;
  paidAt: Date | null;
}) {
  const [pending, startTransition] = useTransition();
  const isPaid = paymentId !== null;

  function handleClick() {
    startTransition(async () => {
      if (isPaid && paymentId) {
        await unmarkPayment(paymentId);
      } else {
        const result = await markPayment(installmentId, installmentNum, new Date());
        if (result.loanCreated) {
          toast.success(`Loan recorded for ${result.debtorName}`);
        }
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      className={cn(
        "h-7 gap-1.5 text-xs",
        isPaid && "border-success/40 bg-success/10 text-success hover:bg-success/15 hover:text-success"
      )}
    >
      {isPaid ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
      {isPaid && paidAt
        ? paidAt.toLocaleDateString("es-CO", { month: "short", day: "numeric", timeZone: "UTC" })
        : "Mark paid"}
    </Button>
  );
}
