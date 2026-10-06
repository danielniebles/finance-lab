import { describe, expect, it } from "vitest";
import {
  amountToDigits, digitsOnly, formatDateLabel, formatThousands, localISODate, parseISODate, shiftISODate,
} from "./form-format";

describe("money input helpers", () => {
  it("keeps digits and drops leading zeros", () => {
    expect(digitsOnly("$ 1.200.000")).toBe("1200000");
    expect(digitsOnly("0045")).toBe("45");
    expect(digitsOnly("0")).toBe("0");
    expect(digitsOnly("abc")).toBe("");
  });
  it("formats thousands with dots", () => {
    expect(formatThousands("1200000")).toBe("1.200.000");
    expect(formatThousands("950")).toBe("950");
    expect(formatThousands("")).toBe("");
  });
  it("turns stored amounts into digits", () => {
    expect(amountToDigits(-48900)).toBe("48900");
    expect(amountToDigits(1200000.4)).toBe("1200000");
    expect(amountToDigits(null)).toBe("");
  });
});

describe("date helpers", () => {
  const now = new Date(2026, 9, 6, 21, 30); // Oct 6 2026, 9:30pm local
  it("uses the local day, not UTC", () => {
    expect(localISODate(now)).toBe("2026-10-06");
  });
  it("parses and shifts across month boundaries", () => {
    expect(parseISODate("2026-10-06")?.getDate()).toBe(6);
    expect(parseISODate("06/10/2026")).toBeNull();
    expect(shiftISODate("2026-11-01", -1)).toBe("2026-10-31");
  });
  it("labels dates", () => {
    expect(formatDateLabel("2026-10-06", now)).toBe("Today, Oct 6");
    expect(formatDateLabel("2026-10-05", now)).toBe("Yesterday, Oct 5");
    expect(formatDateLabel("2026-11-15", now)).toBe("Nov 15");
    expect(formatDateLabel("2027-03-12", now)).toBe("Mar 12, 2027");
    expect(formatDateLabel("", now)).toBe("");
  });
});
