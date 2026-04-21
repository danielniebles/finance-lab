"use client";

import { useTransition } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        await markPayment(installmentId, installmentNum, new Date());
      }
    });
  }

  if (isPaid && paidAt) {
    return (
      <button
        onClick={handleClick}
        disabled={pending}
        className="flex items-center gap-1.5 text-sm text-success hover:text-muted-foreground transition-colors disabled:opacity-50"
      >
        <CheckCircle2 className="size-4" />
        <span className="font-mono text-xs">
          {paidAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </span>
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      className="h-7 gap-1.5 text-xs"
    >
      <Circle className="size-3" />
      Mark paid
    </Button>
  );
}
