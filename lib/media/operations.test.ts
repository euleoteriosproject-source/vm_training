import { describe, expect, it } from "vitest";
import {
  calculatePlanCoverage,
  canTransitionMedia,
  getExercisePublishReadiness,
  isPrimaryChecklistComplete,
  mediaStoragePaths,
  primaryChecklistKeys,
  validateMediaClassification,
  validateAnimatedPrimary,
} from "./operations";

const completeChecklist = Object.fromEntries(
  primaryChecklistKeys.map((key) => [key, true]),
);

describe("media operations", () => {
  it("requires the complete checklist for a primary demo", () => {
    expect(isPrimaryChecklistComplete(completeChecklist)).toBe(true);
    expect(
      validateMediaClassification({
        role: "PRIMARY_DEMO",
        executionQuality: "approved",
        checklist: { ...completeChecklist, license_confirmed: false },
      }),
    ).toMatchObject({ valid: false, errors: ["review_checklist"] });
  });

  it("accepts educational media without the primary checklist", () => {
    expect(
      validateMediaClassification({
        role: "EDUCATIONAL",
        executionQuality: "acceptable",
      }).valid,
    ).toBe(true);
  });

  it("blocks direct pending to approved transitions", () => {
    expect(canTransitionMedia("pending", "approved")).toBe(false);
    expect(canTransitionMedia("pending", "reviewing")).toBe(true);
    expect(canTransitionMedia("processed", "approved")).toBe(true);
  });

  it("calculates 90 percent plan coverage", () => {
    const ids = Array.from({ length: 10 }, (_, index) => String(index));
    expect(calculatePlanCoverage(ids, ids.slice(0, 9))).toMatchObject({
      exercises: 10,
      primaryApproved: 9,
      percentage: 90,
      missing: ["9"],
    });
  });

  it("calculates publish readiness independently of active state", () => {
    expect(
      getExercisePublishReadiness({
        active: false,
        approvedPrimaryMedia: true,
        instructions: ["Controle o movimento"],
        equipmentCount: 1,
        movementPattern: "squat",
        primaryMuscles: ["quadríceps"],
      }),
    ).toMatchObject({ ready: true, active: false });
  });

  it("generates immutable role-aware storage paths", () => {
    const hash = "a".repeat(64);
    expect(
      mediaStoragePaths({
        exerciseSlug: "leg-press",
        role: "PRIMARY_DEMO",
        hash,
      }),
    ).toEqual({
      mediaPath: `exercises/leg-press/primary/${hash}.mp4`,
      videoPath: `exercises/leg-press/primary/${hash}.mp4`,
      gifPath: `exercises/leg-press/primary/${hash}.gif`,
      posterPath: `exercises/leg-press/primary/${hash}.webp`,
    });
  });

  it("rejects static images and single-frame GIFs as PRIMARY", () => {
    expect(
      validateAnimatedPrimary({
        mediaType: "image",
        animationVerified: true,
        frameCount: 1,
        durationSeconds: 5,
        animationLoop: false,
        fallbackReason: null,
      }),
    ).toBe(false);
    expect(
      validateAnimatedPrimary({
        mediaType: "gif",
        animationVerified: true,
        frameCount: 1,
        durationSeconds: 5,
        animationLoop: true,
        fallbackReason: null,
      }),
    ).toBe(false);
  });

  it("accepts animated GIF and documented MP4 fallback", () => {
    expect(
      validateAnimatedPrimary({
        mediaType: "gif",
        animationVerified: true,
        frameCount: 90,
        durationSeconds: 6,
        animationLoop: true,
        fallbackReason: null,
      }),
    ).toBe(true);
    expect(
      validateAnimatedPrimary({
        mediaType: "video",
        animationVerified: true,
        frameCount: 180,
        durationSeconds: 6,
        animationLoop: true,
        fallbackReason: "GIF_SIZE_TOO_LARGE",
      }),
    ).toBe(true);
  });
});
