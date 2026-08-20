import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type MediaEntry = {
  exerciseSlug: string;
  contentHash: string;
  posterHash: string;
};

function readEntries(file: string, key: "entries" | "results") {
  const artifact = JSON.parse(readFileSync(file, "utf8")) as Record<
    string,
    MediaEntry[]
  >;
  return artifact[key];
}

describe("primary media manifest", () => {
  it("preserves canonical GIF and poster hashes for all seven primaries", () => {
    const manifest = readEntries(
      "data/media/primary-media-manifest.json",
      "entries",
    );
    const processing = readEntries(
      "data/media/media-processing-v16.json",
      "results",
    );
    const processingBySlug = new Map(
      processing.map((entry) => [entry.exerciseSlug, entry]),
    );

    expect(manifest).toHaveLength(7);
    for (const entry of manifest) {
      expect(entry.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(entry.posterHash).toMatch(/^[a-f0-9]{64}$/);
      expect(processingBySlug.get(entry.exerciseSlug)?.contentHash).toBe(
        entry.contentHash,
      );
      expect(processingBySlug.get(entry.exerciseSlug)?.posterHash).toBe(
        entry.posterHash,
      );
    }
  });
});
