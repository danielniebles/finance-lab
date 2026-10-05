"use client";

import { useState } from "react";

/**
 * Privacy mode masks every amount on the page; one debtor at a time can be
 * revealed. (Liquidity warnings now come from lib/status toneForLiquidity.)
 */
export function usePrivacyMode() {
  const [privacyMode, setPrivacyMode] = useState(false);
  const [revealedDebtorId, setRevealedDebtorId] = useState<string | null>(null);

  function handleReveal(id: string) {
    setRevealedDebtorId((prev) => (prev === id ? null : id));
  }

  function handlePrivacyToggle() {
    if (privacyMode) setRevealedDebtorId(null);
    setPrivacyMode((prev) => !prev);
  }

  return { privacyMode, revealedDebtorId, handleReveal, handlePrivacyToggle };
}
