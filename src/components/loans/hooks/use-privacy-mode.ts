"use client";

import { useState } from "react";

interface UsePrivacyModeProps {
  ratio: number | null;
}

export function usePrivacyMode({ ratio }: UsePrivacyModeProps) {
  const [privacyMode, setPrivacyMode] = useState(false);
  const [revealedDebtorId, setRevealedDebtorId] = useState<string | null>(null);

  const liquidityWarn = !privacyMode && ratio !== null && ratio < 10;

  function handleReveal(id: string) {
    setRevealedDebtorId((prev) => (prev === id ? null : id));
  }

  function handlePrivacyToggle() {
    if (privacyMode) setRevealedDebtorId(null);
    setPrivacyMode((prev) => !prev);
  }

  return { privacyMode, revealedDebtorId, handleReveal, handlePrivacyToggle, liquidityWarn };
}
