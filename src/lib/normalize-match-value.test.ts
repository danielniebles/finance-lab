import { describe, it, expect } from "vitest";
import { normalizeMatchValue, looksLikeRealAccountNumber } from "./normalize-match-value";

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
