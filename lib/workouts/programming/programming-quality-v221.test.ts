import { describe, expect, it } from "vitest";
import { generatePlanWithQuality, scoreExercise } from "../generator";
import type {
  ExerciseCandidate,
  GoalCode,
  PlanInput,
  TrainingArchitecture,
  TrainingSlot,
} from "../types";
import { resolveGoalStrategy } from "./goal-strategy";
import { capabilitiesForGym } from "../gym-capabilities";
import { compilePlan, matchesSlot } from "./plan-compiler";
import { normalizeTrainingProfile } from "./profile-normalizer";

const patterns = [
  "squat", "hinge", "knee_extension", "knee_flexion", "horizontal_push",
  "vertical_push", "horizontal_pull", "vertical_pull", "posture", "mobility",
  "core_anti_rotation", "cardio",
];

const catalog = patterns.flatMap((pattern) => [1, 2].map((variant) => exercise(
  `${pattern}-${variant}`,
  pattern,
  pattern === "cardio" ? "cardio_machine" : "commercial_machine",
  pattern === "cardio" ? "cardio" : pattern === "mobility" ? "mobility" : "strength",
  `${pattern}-${variant}`,
)));

const baseInput: PlanInput = {
  goals: [{ code: "posture", priority: 1 }],
  sessionsPerWeek: 3,
  sessionMinutes: 60,
  cardioPreference: 2,
  experience: "returning",
  equipment: [],
  gymProfile: "STANDARD_COMMERCIAL_GYM",
  workoutStyle: "gym_first",
  catalogVersion: "v221-fixture",
};

describe("v2.2.1 programming quality refinement", () => {
  it("prunes covered posture correctives and keeps only those with an uncovered need", () => {
    const result = generatePlanWithQuality(baseInput, catalog);
    const daySizes = result.days.map((day) => day.exercises.length);
    expect(daySizes.every((size) => size >= 5 && size <= 6)).toBe(true);
    expect(daySizes.some((size) => size === 5)).toBe(true);
    expect(result.prunedSlots?.length).toBeGreaterThan(0);
    expect(result.slots?.filter((slot) => slot.role === "CORRECTIVE").every(
      (slot) => slot.needStatus !== "COVERED" && slot.programmingValue >= slot.minimumProgrammingValue,
    )).toBe(true);
    expect(result.quality).toMatchObject({ fillerSlots: 0, unjustifiedCorrectiveSlots: 0, slotJustificationStatus: "PASS" });
    for (const day of result.days) {
      const selectedPatterns = day.exercises.map(
        (item) => catalog.find((candidate) => candidate.id === item.exerciseId)?.pattern,
      );
      expect(new Set(selectedPatterns).size).toBe(selectedPatterns.length);
    }
  });

  it("retains a valuable sixth exercise for a genuine supporting-volume need", () => {
    const result = generatePlanWithQuality({ ...baseInput, goals: [{ code: "muscle_gain", priority: 1 }] }, catalog);
    expect(result.days.flatMap((day) => day.exercises).length).toBeGreaterThan(15);
    expect(result.slots?.filter((slot) => slot.requirement === "OPTIONAL").every(
      (slot) => slot.programmingValue >= slot.minimumProgrammingValue,
    )).toBe(true);
  });

  it("prefers an exact commercial-gym match over a comparable floor option", () => {
    const slot = singleSlot("horizontal_pull");
    const machine = exercise("machine-row", "horizontal_pull", "commercial_machine", "strength", "row-machine");
    const floor = exercise("floor-row", "horizontal_pull", "bodyweight_floor", "strength", "row-floor");
    expect(compileSingle(slot, [floor, machine]).exerciseId).toBe(machine.id);
  });

  it("allows the floor option when no valid gym alternative exists", () => {
    const slot = singleSlot("posture", "CORRECTIVE");
    const floor = exercise("floor-extension", "posture", "bodyweight_floor", "strength", "posture-floor");
    expect(matchesSlot(floor, slot)).toBe(true);
    expect(compileSingle(slot, [floor]).exerciseId).toBe(floor.id);
  });

  it("chooses strong functional fit over a functionally wrong machine", () => {
    const slot = { ...singleSlot("horizontal_pull"), patterns: ["horizontal_pull", "posture"] };
    const wrongMachine = exercise("machine-extension", "posture", "commercial_machine", "strength", "posture-machine");
    const exactFreeWeight = exercise("barbell-row", "horizontal_pull", "commercial_free_weight", "strength", "row-free");
    expect(compileSingle(slot, [wrongMachine, exactFreeWeight]).exerciseId).toBe(exactFreeWeight.id);
  });

  it("lets an explicit valid preference override the environment default", () => {
    const slot = singleSlot("horizontal_pull");
    const machine = exercise("machine-row", "horizontal_pull", "commercial_machine", "strength", "row-machine");
    const floor = exercise("preferred-floor-row", "horizontal_pull", "bodyweight_floor", "strength", "row-floor");
    expect(compileSingle(slot, [machine, floor], { [floor.id]: "like" }).exerciseId).toBe(floor.id);
  });

  it("does not reward incomplete metadata over a known-valid candidate", () => {
    const slot = singleSlot("horizontal_pull");
    const complete = exercise("complete-row", "horizontal_pull", "commercial_machine", "strength", "row-complete");
    const incomplete = { ...complete, id: "incomplete-row", name: "incomplete-row", exerciseFamily: undefined, fatigueProfile: undefined };
    expect(compileSingle(slot, [incomplete, complete]).exerciseId).toBe(complete.id);
  });

  it("keeps posture resistance-based and differentiates it from muscle gain", () => {
    const posture = generatePlanWithQuality(baseInput, catalog);
    const muscle = generatePlanWithQuality({ ...baseInput, goals: [{ code: "muscle_gain", priority: 1 }] }, catalog);
    expect(posture.quality.goalAlignment.status).toBe("PASS");
    expect(posture.quality.goalAlignment.strengthSlots).toBeGreaterThanOrEqual(9);
    expect(posture.days).not.toEqual(muscle.days);
  });

  it("keeps the commercial back-extension capability eligible for posture plans", () => {
    const backExtension = exercise(
      "back-extension-machine",
      "posture",
      "commercial_machine",
      "strength",
      "back-extension-machine",
    );
    backExtension.capabilities = ["hip_extension"];
    const input = {
      ...baseInput,
      capabilities: capabilitiesForGym("STANDARD_COMMERCIAL_GYM"),
    };

    expect(capabilitiesForGym("STANDARD_COMMERCIAL_GYM")).toEqual(
      expect.arrayContaining(["hip_accessory", "hip_extension"]),
    );
    expect(generatePlanWithQuality(input, [...catalog, backExtension]).quality)
      .toMatchObject({ environmentContextFitStatus: "PASS", programQualityStatus: "PASS" });
  });

  it("answers why every selected exercise exists using need and weekly context", () => {
    const result = generatePlanWithQuality(baseInput, catalog);
    for (const item of result.days.flatMap((day) => day.exercises)) {
      expect(item.programmingNeed).toBeTruthy();
      expect(item.rationale).toMatch(/semana|semanal/);
    }
  });

  it("is exactly deterministic across three identical runs", () => {
    const runs = [1, 2, 3].map(() => generatePlanWithQuality(baseInput, [...catalog]));
    expect(runs[0]).toEqual(runs[1]);
    expect(runs[1]).toEqual(runs[2]);
  });
});

function compileSingle(
  slot: TrainingSlot,
  candidates: ExerciseCandidate[],
  preferences?: PlanInput["preferences"],
) {
  const input = { ...baseInput, sessionsPerWeek: 2 as const, preferences };
  const profile = normalizeTrainingProfile(input);
  const strategy = resolveGoalStrategy(profile);
  const architecture: TrainingArchitecture = {
    id: "single",
    rationale: "fixture",
    days: [{ name: "A", focus: "fixture", patternBias: slot.patterns }],
  };
  return compilePlan(
    input,
    profile,
    strategy,
    architecture,
    [slot],
    candidates.map((candidate) => ({ exercise: candidate, score: scoreExercise(candidate, input) })),
  )[0].exercises[0];
}

function singleSlot(pattern: string, role: TrainingSlot["role"] = "SECONDARY_PULL"): TrainingSlot {
  return {
    id: "single-slot", dayIndex: 0, position: 0, role, patterns: [pattern], targetMuscles: ["back"],
    priority: "medium", fatigueBudget: "medium", maxTechnicalComplexity: "high", rationale: "fixture",
    need: pattern === "posture" ? "SCAPULAR_CONTROL" : "HORIZONTAL_PULL", needStatus: "UNMET",
    requirement: role === "CORRECTIVE" ? "OPTIONAL" : "REQUIRED", programmingValue: 70,
    minimumProgrammingValue: role === "CORRECTIVE" ? 45 : 0, estimatedTimeMinutes: 7,
    redundancy: 0, justification: "A necessidade ainda não está coberta na semana.",
  };
}

function exercise(
  id: string,
  pattern: string,
  environmentProfile: ExerciseCandidate["environmentProfile"],
  category: ExerciseCandidate["category"],
  family: string,
): ExerciseCandidate {
  return {
    id, name: id, pattern, trainingRole: "primary", category, equipment: [], difficulty: "beginner",
    active: true, hasApprovedMedia: true, mediaReady: true, autoPlanEligible: true,
    environmentProfile, gymEquipmentTier: environmentProfile === "commercial_machine" ? 1 : environmentProfile === "commercial_free_weight" ? 2 : 3,
    technicalComplexity: "low", goalSuitability: patternsForGoals(), primaryMuscles: ["back"], secondaryMuscles: [],
    exerciseFamily: family, fatigueProfile: "low", stabilityProfile: "high",
  };
}

function patternsForGoals(): GoalCode[] {
  return ["posture", "muscle_gain", "strength", "mobility", "conditioning", "general_health"];
}
