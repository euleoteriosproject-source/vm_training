import { describe, expect, it } from "vitest";
import { reconcileMediaIntegrity, type PrimaryMediaRecord } from "./integrity";

const valid: PrimaryMediaRecord = {
  id: "media-1",
  exerciseId: "exercise-1",
  mediaType: "gif",
  storagePath: "exercises/test/primary/hash.gif",
  posterPath: "exercises/test/primary/hash.webp",
  contentHash: "hash",
  actualHash: "hash",
  animationVerified: true,
  frameCount: 90,
  durationSeconds: 6,
  animationLoop: true,
};

describe("media integrity reconciliation", () => {
  it("accepts a complete animated primary", () => {
    expect(
      reconcileMediaIntegrity([valid], [valid.storagePath!, valid.posterPath!]),
    ).toEqual([]);
  });

  it("reports static, single-frame, duplicate, missing and orphaned media", () => {
    const issues = reconcileMediaIntegrity(
      [
        {
          ...valid,
          mediaType: "image",
          animationVerified: false,
          frameCount: 1,
        },
        { ...valid, id: "media-2", storagePath: "missing.gif", frameCount: 1 },
      ],
      [valid.storagePath!, "orphan.gif"],
    );
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "PRIMARY_STATIC_IMAGE",
        "APPROVED_WITHOUT_ANIMATION",
        "GIF_SINGLE_FRAME",
        "DUPLICATE_PRIMARY",
        "DB_WITHOUT_FILE",
        "APPROVED_WITHOUT_POSTER",
        "FILE_WITHOUT_DB",
      ]),
    );
  });

  it("does not classify a file referenced by a non-primary record as orphaned", () => {
    const issues = reconcileMediaIntegrity(
      [valid],
      [valid.storagePath!, valid.posterPath!, "candidate.gif"],
      [valid.storagePath!, valid.posterPath!, "candidate.gif"],
    );
    expect(issues).toEqual([]);
  });
});
