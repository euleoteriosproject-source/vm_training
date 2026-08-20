import { describe, expect, it } from "vitest";
import { buildAttribution, resolveLicense } from "./licenses";
describe("media license validation", () => {
  it.each([
    ["Public domain", "PD"],
    ["CC0 1.0", "CC0-1.0"],
    ["CC BY 4.0", "CC-BY-4.0"],
    ["CC BY-SA 3.0", "CC-BY-SA-3.0"],
  ])("accepts %s", (raw, code) => expect(resolveLicense(raw)?.code).toBe(code));
  it("rejects ambiguous licenses", () =>
    expect(resolveLicense("Free to watch")).toBeNull());
  it("generates attribution", () => {
    const license = resolveLicense("CC BY 4.0")!;
    expect(
      buildAttribution({
        title: "Squat",
        author: "Author",
        sourceName: "Wikimedia Commons",
        license,
      }),
    ).toContain("Autor: Author");
  });
});
