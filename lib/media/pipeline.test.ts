import { describe, expect, it } from "vitest";
import { validateApproval } from "./approval";
import { calculateCoverage } from "./coverage";
import { findDuplicateHash } from "./deduplication";
import { validateExternalMediaUrl } from "./url-safety";
describe("media pipeline", () => {
  it("detects duplicate hashes case-insensitively", () =>
    expect(findDuplicateHash("ABC", ["abc"])).toBe("abc"));
  it("requires legal and technical approval fields", () => {
    expect(
      validateApproval({
        status: "reviewing",
        storagePath: "main.mp4",
        posterPath: "poster.webp",
        contentHash: "abc",
        licenseCode: "CC-BY-4.0",
        verifiedBy: "user",
        executionQuality: "approved",
        attributionRequired: true,
        author: null,
        attributionText: null,
        licenseUrl: null,
        mediaRole: "PRIMARY_DEMO",
        checklist: {},
        processedAt: null,
      }),
    ).toMatchObject({
      valid: false,
      errors: expect.arrayContaining(["attribution"]),
    });
    expect(
      validateApproval({
        status: "processed",
        storagePath: "main.mp4",
        posterPath: "poster.webp",
        contentHash: "abc",
        licenseCode: "PD",
        verifiedBy: "user",
        executionQuality: "approved",
        attributionRequired: false,
        author: "CDC",
        attributionText: "CDC / Wikimedia Commons / Public Domain",
        licenseUrl:
          "https://commons.wikimedia.org/wiki/Commons:Copyright_tags/Public_domain",
        mediaRole: "PRIMARY_DEMO",
        checklist: {
          correct_exercise: true,
          compatible_equipment: true,
          start_position_visible: true,
          main_range_visible: true,
          complete_repetition_visible: true,
          technically_acceptable: true,
          sufficient_clarity: true,
          useful_framing: true,
          no_blocking_elements: true,
          license_confirmed: true,
        },
        processedAt: new Date().toISOString(),
        mediaType: "gif",
        animationVerified: true,
        frameCount: 90,
        durationSeconds: 6,
        animationLoop: true,
        fallbackReason: null,
      }).valid,
    ).toBe(true);
  });
  it("calculates coverage and active gaps", () =>
    expect(
      calculateCoverage([
        {
          exerciseId: "1",
          name: "A",
          active: true,
          mediaStatuses: ["approved"],
        },
        { exerciseId: "2", name: "B", active: true, mediaStatuses: [] },
      ]),
    ).toMatchObject({
      total: 2,
      approved: 1,
      missing: 1,
      coverage: 50,
      activeMissing: [expect.objectContaining({ name: "B" })],
      candidateCoverage: 50,
    }));
  it("blocks SSRF and insecure URLs", () => {
    expect(() =>
      validateExternalMediaUrl("http://upload.wikimedia.org/file.webm"),
    ).toThrow(/HTTPS/);
    expect(() =>
      validateExternalMediaUrl("https://127.0.0.1/file.mp4"),
    ).toThrow(/Host/);
    expect(
      validateExternalMediaUrl("https://upload.wikimedia.org/file.webm")
        .hostname,
    ).toBe("upload.wikimedia.org");
  });
});
