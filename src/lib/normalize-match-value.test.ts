import { describe, it, expect } from "vitest";
import {
  counterpartyKeyMatches,
  counterpartyMatchKey,
  looksLikeRealAccountNumber,
  normalizeMatchValue,
} from "./normalize-match-value";

describe("normalizeMatchValue", () => {
  describe("ACCOUNT — digits only", () => {
    it("strips spaces and dashes", () => {
      expect(normalizeMatchValue("ACCOUNT", "617-9361 4704")).toBe("61793614704");
    });

    it("strips non-digit words like 'cuenta'", () => {
      expect(normalizeMatchValue("ACCOUNT", "cuenta 61793614704")).toBe("61793614704");
    });

    it("leaves an already-digits-only string unchanged", () => {
      expect(normalizeMatchValue("ACCOUNT", "61793614704")).toBe("61793614704");
    });

    it("returns an empty string when there are no digits", () => {
      expect(normalizeMatchValue("ACCOUNT", "no digits here")).toBe("");
    });
  });

  describe("MERCHANT / SENDER / KEYWORD — trim + uppercase", () => {
    it("uppercases a merchant name", () => {
      expect(normalizeMatchValue("MERCHANT", "rappi")).toBe("RAPPI");
    });

    it("trims leading/trailing whitespace", () => {
      expect(normalizeMatchValue("SENDER", "  Juan Pérez  ")).toBe("JUAN PÉREZ");
    });

    it("normalizes a keyword the same way", () => {
      expect(normalizeMatchValue("KEYWORD", " netflix ")).toBe("NETFLIX");
    });

    it("is idempotent — normalizing twice gives the same result", () => {
      const once = normalizeMatchValue("MERCHANT", "  Rappi Turbo ");
      const twice = normalizeMatchValue("MERCHANT", once);
      expect(twice).toBe(once);
    });
  });
});

describe("counterpartyMatchKey", () => {
  it("gives the same key to every spelling of a merchant", () => {
    const keys = ["UBER RIDES", "UBER*RIDES", "UBERRIDES", " uber-rides "].map(counterpartyMatchKey);
    expect(new Set(keys)).toEqual(new Set(["UBERRIDES"]));
  });

  it("drops accents", () => {
    expect(counterpartyMatchKey("Juan Pérez")).toBe("JUANPEREZ");
  });
});

describe("counterpartyKeyMatches", () => {
  it("matches equal keys", () => {
    expect(counterpartyKeyMatches("UBERRIDES", "UBERRIDES")).toBe(true);
  });

  it("matches when the rule key is a prefix of the candidate", () => {
    expect(counterpartyKeyMatches("UBERRIDES", "UBERRIDESDL")).toBe(true);
  });

  it("does not match the other way round", () => {
    expect(counterpartyKeyMatches("UBERRIDESDL", "UBERRIDES")).toBe(false);
  });

  it("ignores prefixes shorter than 4 characters", () => {
    expect(counterpartyKeyMatches("UBE", "UBERRIDES")).toBe(false);
  });

  it("never matches an empty key", () => {
    expect(counterpartyKeyMatches("", "UBER")).toBe(false);
  });
});

describe("looksLikeRealAccountNumber", () => {
  it("is true for a plain digit string", () => {
    expect(looksLikeRealAccountNumber("61793614704")).toBe(true);
  });

  it("is true when digits are mixed with separators/words", () => {
    expect(looksLikeRealAccountNumber("cuenta 617-9361 4704")).toBe(true);
  });

  it("is false for a name-only value with no digits at all", () => {
    expect(looksLikeRealAccountNumber("MARIA NELLY CORRAI ES OSORIO")).toBe(false);
  });
});
