import { describe, it, expect } from "vitest";
import { historySearchToken, pickHistoricalCategoryId } from "./category-history";

describe("historySearchToken", () => {
  it("takes the first letters of the first word", () => {
    expect(historySearchToken("UBER RIDES")).toBe("UBER");
    expect(historySearchToken("*Rappi Turbo")).toBe("Rapp");
  });

  it("is undefined without letters or digits", () => {
    expect(historySearchToken(" *- ")).toBeUndefined();
  });
});

describe("pickHistoricalCategoryId", () => {
  it("picks the most frequent category for the same counterparty", () => {
    const rows = [
      { note: "UBER*RIDES", appCategoryId: "going-out" },
      { note: "Uber", appCategoryId: "going-out" },
      { note: "UBER RIDES", appCategoryId: "car" },
    ];
    expect(pickHistoricalCategoryId(rows, "UBER RIDES")).toBe("going-out");
  });

  it("ignores other merchants that share the search token", () => {
    const rows = [
      { note: "UBER EATS", appCategoryId: "food" },
      { note: "UBER EATS", appCategoryId: "food" },
      { note: "UBERRIDES", appCategoryId: "going-out" },
    ];
    expect(pickHistoricalCategoryId(rows, "UBER RIDES")).toBe("going-out");
  });

  it("breaks a tie with the most recent row (rows come newest first)", () => {
    const rows = [
      { note: "Rappi", appCategoryId: "supermarket" },
      { note: "Rappi", appCategoryId: "going-out" },
    ];
    expect(pickHistoricalCategoryId(rows, "RAPPI")).toBe("supermarket");
  });

  it("is undefined with no matching history", () => {
    expect(pickHistoricalCategoryId([{ note: "Netflix", appCategoryId: "x" }], "UBER")).toBeUndefined();
    expect(pickHistoricalCategoryId([{ note: null, appCategoryId: "x" }], "UBER")).toBeUndefined();
  });
});
