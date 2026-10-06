import { describe, expect, it } from "vitest";
import { joinTagDraft, parseTagNames, splitTagDraft, tagSuggestions } from "./tag-utils";

describe("tag chip draft", () => {
  it("splits committed chips from the text being typed", () => {
    expect(splitTagDraft("")).toEqual({ tags: [], draft: "" });
    expect(splitTagDraft("ub")).toEqual({ tags: [], draft: "ub" });
    expect(splitTagDraft("Uber, work-trip, fru")).toEqual({ tags: ["uber", "work-trip"], draft: "fru" });
    expect(splitTagDraft("uber, ")).toEqual({ tags: ["uber"], draft: "" });
  });
  it("round-trips and still parses the draft on submit", () => {
    const raw = joinTagDraft(["uber", "work-trip"], "fruver");
    expect(splitTagDraft(raw)).toEqual({ tags: ["uber", "work-trip"], draft: "fruver" });
    expect(parseTagNames(raw)).toEqual(["uber", "work-trip", "fruver"]);
    expect(joinTagDraft([], "x")).toBe("x");
  });
  it("suggests matching names not yet added", () => {
    const all = ["fruver", "fuel", "gift", "uber"];
    expect(tagSuggestions(all, ["fuel"], "f")).toEqual(["fruver"]);
    expect(tagSuggestions(all, [], "")).toEqual([]);
  });
});
