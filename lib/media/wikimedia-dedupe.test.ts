import { describe, expect, it } from "vitest";
import { deduplicateWikiPages } from "../../scripts/media/wikimedia";

describe("Wikimedia discovery helpers", () => {
  it("returns the same file only once when three queries find it", () => {
    const page = { title: "File:Leg Extension.webm" };
    expect(deduplicateWikiPages([page, { ...page }, { ...page }])).toEqual([
      page,
    ]);
  });
});
