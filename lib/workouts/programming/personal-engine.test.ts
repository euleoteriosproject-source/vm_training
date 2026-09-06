import { describe, expect, it } from "vitest";
import { generatePlanWithQuality } from "../generator";
import type { ExerciseCandidate, GoalCode, PlanInput } from "../types";
import { resolveGoalStrategy } from "./goal-strategy";
import { normalizeTrainingProfile } from "./profile-normalizer";
import { recommendProgression } from "./progression";

const patterns = [
  "squat", "hinge", "hip_extension", "knee_extension", "knee_flexion",
  "horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull",
  "core_anti_rotation", "core_anti_extension", "carry", "posture", "mobility", "cardio",
];

const catalog: ExerciseCandidate[] = patterns.flatMap((pattern) =>
  [1, 2, 3].map((variant) => ({
    id: `${pattern}-${variant}`,
    name: `${pattern} ${variant}`,
    pattern,
    trainingRole: variant === 1 ? "primary" : "accessory",
    category: pattern === "cardio" ? "cardio" as const : pattern === "mobility" ? "mobility" as const : "strength" as const,
    equipment: [],
    difficulty: "beginner" as const,
    active: true,
    hasApprovedMedia: true,
    mediaReady: true,
    autoPlanEligible: true,
    environmentProfile: pattern === "cardio" ? "cardio_machine" as const : "commercial_machine" as const,
    gymEquipmentTier: 1 as const,
    technicalComplexity: variant === 3 ? "moderate" as const : "low" as const,
    goalSuitability: ["general_health", "muscle_gain", "strength", "conditioning", "mobility", "posture"] as GoalCode[],
    primaryMuscles: muscles(pattern),
    exerciseFamily: `${pattern}-${variant === 3 ? "alternate" : "standard"}`,
    fatigueProfile: variant === 3 ? "medium" as const : "low" as const,
    stabilityProfile: "high" as const,
  })),
);

const input: PlanInput = {
  goals: [{ code: "muscle_gain", priority: 1 }],
  sessionsPerWeek: 3,
  sessionMinutes: 60,
  cardioPreference: 2,
  experience: "returning",
  equipment: [],
  gymProfile: "STANDARD_COMMERCIAL_GYM",
  workoutStyle: "gym_first",
  catalogVersion: "test-catalog-1",
};

describe("v2.2.0 personal programming engine", () => {
  it("defines strategy and architecture before exercise selection", () => {
    const result = generatePlanWithQuality(input, catalog);
    expect(result.architecture?.id).toBe("full-body-3");
    expect(result.slots).toHaveLength(18);
    expect(result.slots?.every((slot) => slot.role && slot.patterns.length > 0)).toBe(true);
    expect(result.days.every((day) => day.exercises.every((exercise) => exercise.slotRole))).toBe(true);
  });

  it("changes architecture for goal at specialized frequencies", () => {
    const muscle = generatePlanWithQuality({ ...input, sessionsPerWeek: 5 }, catalog);
    const conditioning = generatePlanWithQuality({
      ...input, sessionsPerWeek: 5, goals: [{ code: "conditioning", priority: 1 }], cardioPreference: 4,
    }, catalog);
    expect(muscle.architecture?.days.map((day) => day.name)).not.toEqual(
      conditioning.architecture?.days.map((day) => day.name),
    );
  });

  it("changes weekly architecture for every supported frequency", () => {
    const ids = ([2, 3, 4, 5] as const).map((sessionsPerWeek) =>
      generatePlanWithQuality({ ...input, sessionsPerWeek, sessionMinutes: 45 }, catalog).architecture?.id,
    );
    expect(new Set(ids).size).toBe(4);
  });

  it("adds useful slots as duration grows", () => {
    const counts = ([30, 45, 60, 75, 90] as const).map((sessionMinutes) =>
      generatePlanWithQuality({ ...input, sessionMinutes }, catalog).quality.totalSlots,
    );
    expect(counts).toEqual([12, 15, 18, 21, 24]);
  });

  it("evaluates whole-week balance, order, volume and family frequency", () => {
    const result = generatePlanWithQuality(input, catalog);
    expect(result.quality.weeklyBalanceStatus).toBe("PASS");
    expect(result.quality.volumeValidationStatus).toBe("PASS");
    expect(result.quality.frequencyValidationStatus).toBe("PASS");
    expect(result.quality.functionalRepetitionStatus).toBe("PASS");
    expect(result.quality.orderingStatus).toBe("PASS");
    expect(result.quality.programQualityStatus).toBe("PASS");
    expect(Object.keys(result.quality.weeklyVolumeSets ?? {}).length).toBeGreaterThan(0);
    expect(Object.keys(result.quality.exerciseFamilyFrequency ?? {}).length).toBeGreaterThan(0);
  });

  it("is deterministic for identical inputs and catalog version", () => {
    const first = generatePlanWithQuality(input, catalog);
    const second = generatePlanWithQuality(input, [...catalog].reverse());
    expect(first.days).toEqual(second.days);
    expect(first.quality.determinismKey).toBe(second.quality.determinismKey);
  });

  it("persists a concise selection reason and conservative progression state", () => {
    const result = generatePlanWithQuality(input, catalog);
    expect(result.days[0].exercises[0].rationale).toContain("apoia hipertrofia");
    expect(result.days[0].exercises[0].progression?.state).toBe("INSUFFICIENT_DATA");
  });

  it("keeps selection explanations aligned with the exercise actually chosen", () => {
    const result = generatePlanWithQuality(input, catalog);
    const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));
    for (const day of result.days)
      for (const exercise of day.exercises)
        expect(exercise.rationale).toContain(`padrão ${byId.get(exercise.exerciseId)?.pattern}`);
  });

  it("progresses only after repeated complete performance at the upper target", () => {
    const history = ["2026-09-05", "2026-09-01"].map((completedAt) => ({
      exerciseId: "squat-1", completedAt, prescribedSets: 3, completedSets: 3,
      prescribedRepMin: 8, prescribedRepMax: 12, actualReps: [12, 12, 12], loadKg: [40, 40, 40],
    }));
    expect(recommendProgression("squat-1", history).state).toBe("PROGRESS");
    expect(recommendProgression("squat-2", history).state).toBe("INSUFFICIENT_DATA");
  });

  it("regresses conservatively when recent performance is below prescription", () => {
    const history = ["2026-09-05", "2026-09-01"].map((completedAt) => ({
      exerciseId: "squat-1", completedAt, prescribedSets: 4, completedSets: 2,
      prescribedRepMin: 8, prescribedRepMax: 12, actualReps: [6, 5], loadKg: [50, 50],
    }));
    expect(recommendProgression("squat-1", history)).toMatchObject({ state: "REGRESS", loadChangePercent: -5 });
  });

  it("keeps explicit avoid preferences out of every slot", () => {
    const result = generatePlanWithQuality({ ...input, preferences: { "squat-1": "avoid" } }, catalog);
    expect(result.days.flatMap((day) => day.exercises).some((exercise) => exercise.exerciseId === "squat-1")).toBe(false);
  });

  it("uses role-specific prescriptions instead of one universal prescription", () => {
    const result = generatePlanWithQuality({ ...input, sessionMinutes: 45, goals: [{ code: "strength", priority: 1 }] }, catalog);
    const prescriptions = new Set(result.days[0].exercises.map((exercise) => `${exercise.sets}:${exercise.repMin}:${exercise.repMax}:${exercise.restSeconds}`));
    expect(prescriptions.size).toBeGreaterThan(1);
  });

  it("normalizes profile defaults and resolves a goal strategy deterministically", () => {
    const profile = normalizeTrainingProfile({ ...input, workoutStyle: undefined });
    expect(profile.workoutStyle).toBe("gym_first");
    expect(resolveGoalStrategy(profile)).toEqual(resolveGoalStrategy(profile));
  });
});

function muscles(pattern: string) {
  if (["squat", "knee_extension"].includes(pattern)) return ["quadriceps"];
  if (["hinge", "knee_flexion"].includes(pattern)) return ["hamstrings"];
  if (pattern === "hip_extension") return ["glutes"];
  if (pattern.includes("push")) return pattern.startsWith("horizontal") ? ["chest", "triceps"] : ["shoulders", "triceps"];
  if (pattern.includes("pull")) return ["back", "biceps"];
  if (pattern.startsWith("core") || pattern === "carry") return ["core"];
  return [];
}
