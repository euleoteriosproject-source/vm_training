import { describe, expect, it } from "vitest";
import {
  generatePlan,
  generatePlanWithQuality,
  isExerciseEligible,
  PlanConstraintError,
} from "./generator";
import type { ExerciseCandidate, PlanInput } from "./types";

const candidate = (
  id: string,
  pattern: string,
  equipment: string[] = ["bodyweight"],
): ExerciseCandidate => ({
  id,
  name: id,
  pattern,
  category: pattern === "mobility" ? "mobility" : "strength",
  equipment,
  difficulty: "beginner",
  active: true,
  hasApprovedMedia: true,
  mediaReady: true,
  autoPlanEligible: true,
});

const diverseCatalog: ExerciseCandidate[] = [
  candidate("squat-1", "squat"),
  candidate("squat-2", "squat"),
  candidate("squat-3", "squat"),
  candidate("row-1", "horizontal_pull"),
  candidate("row-2", "horizontal_pull"),
  candidate("hinge-1", "hinge"),
  candidate("hip-extension-1", "hip_extension"),
  candidate("knee-flexion-1", "knee_flexion"),
  candidate("vertical-push-1", "vertical_push"),
  candidate("vertical-push-2", "vertical_push"),
  candidate("carry-1", "carry", ["dumbbells"]),
  candidate("core-extension-1", "core_anti_extension"),
  candidate("core-extension-2", "core_anti_extension"),
  candidate("horizontal-push-1", "horizontal_push"),
  candidate("horizontal-push-2", "horizontal_push"),
  candidate("vertical-pull-1", "vertical_pull"),
  candidate("vertical-pull-2", "vertical_pull"),
  candidate("knee-extension-1", "knee_extension"),
  candidate("core-rotation-1", "core_anti_rotation", ["cable"]),
  candidate("posture-1", "posture"),
  candidate("posture-2", "posture"),
  candidate("mobility-1", "mobility"),
];

const input: PlanInput = {
  goals: [{ code: "general_health", priority: 1 }],
  sessionsPerWeek: 3,
  sessionMinutes: 60,
  cardioPreference: 1,
  experience: "beginner",
  equipment: ["bodyweight", "dumbbells", "cable"],
};

describe("generatePlan v2.1", () => {
  it("builds a deterministic 3-day, 18-slot plan", () => {
    const first = generatePlanWithQuality(input, diverseCatalog);
    const second = generatePlanWithQuality(input, diverseCatalog);
    expect(first).toEqual(second);
    expect(first.days).toHaveLength(3);
    expect(first.quality.totalSlots).toBe(18);
  });

  it("meets the standard diversity and coverage gates", () => {
    const result = generatePlanWithQuality(input, diverseCatalog);
    expect(result.quality.uniqueExercises).toBeGreaterThanOrEqual(12);
    expect(result.quality.uniqueExercises).toBeLessThanOrEqual(15);
    expect(result.quality.maxExactExerciseFrequency).toBeLessThanOrEqual(2);
    expect(result.quality.exactExerciseOnAllDays).toEqual([]);
    expect(
      Object.values(result.quality.dayPairOverlapPercent).every(
        (percent) => percent <= 50,
      ),
    ).toBe(true);
    expect(result.quality.movementPatternCount).toBeGreaterThanOrEqual(8);
    expect(result.quality.mediaCoveragePercent).toBe(100);
    expect(result.quality.invalidEquipment).toEqual([]);
    expect(result.quality.ineligibleExercises).toEqual([]);
  });

  it("keeps the compatibility wrapper", () => {
    const days = generatePlan(input, diverseCatalog);
    expect(days).toHaveLength(3);
    expect(days.flatMap((day) => day.exercises)).toHaveLength(18);
  });

  it("never lets inactive, invalid-media or server-ineligible items in", () => {
    const invalid = [
      { ...candidate("inactive", "squat"), active: false },
      { ...candidate("no-media", "squat"), mediaReady: false },
      { ...candidate("server-blocked", "squat"), autoPlanEligible: false },
    ];
    const result = generatePlanWithQuality(input, [
      ...diverseCatalog,
      ...invalid,
    ]);
    const ids = result.days.flatMap((day) =>
      day.exercises.map((exercise) => exercise.exerciseId),
    );
    expect(ids).not.toContain("inactive");
    expect(ids).not.toContain("no-media");
    expect(ids).not.toContain("server-blocked");
  });

  it("excludes unavailable equipment and movement-attention patterns", () => {
    expect(
      isExerciseEligible(candidate("machine", "squat", ["smith"]), input),
    ).toBe(false);
    expect(
      isExerciseEligible(candidate("attention", "squat"), {
        ...input,
        movementAttentionPatterns: ["squat"],
      }),
    ).toBe(false);
  });

  it("blocks rather than silently emitting a low-diversity plan", () => {
    try {
      generatePlanWithQuality(input, diverseCatalog.slice(0, 11));
      throw new Error("expected generator constraint failure");
    } catch (error) {
      expect(error).toBeInstanceOf(PlanConstraintError);
      expect((error as PlanConstraintError).diagnostics[0].code).toBe(
        "INSUFFICIENT_ELIGIBLE_POOL",
      );
    }
  });

  it("keeps constrained non-standard splits safe", () => {
    const constrainedInput: PlanInput = {
      ...input,
      sessionsPerWeek: 2,
      sessionMinutes: 45,
      equipment: ["bodyweight"],
    };
    const result = generatePlanWithQuality(constrainedInput, diverseCatalog);
    expect(result.days).toHaveLength(2);
    expect(result.quality.invalidEquipment).toEqual([]);
    expect(result.quality.ineligibleExercises).toEqual([]);
    expect(result.quality.mediaCoveragePercent).toBe(100);
  });
});
