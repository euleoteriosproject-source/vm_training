import { describe, expect, it } from "vitest";
import {
  generatePlan,
  generatePlanWithQuality,
  isExerciseEligible,
  PlanConstraintError,
  scoreExercise,
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
  category:
    pattern === "mobility"
      ? "mobility"
      : pattern === "cardio"
        ? "cardio"
        : "strength",
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
  candidate("cardio-1", "cardio", ["treadmill"]),
  candidate("cardio-2", "cardio", ["bike"]),
  candidate("cardio-3", "cardio", ["elliptical"]),
];

const input: PlanInput = {
  goals: [{ code: "general_health", priority: 1 }],
  sessionsPerWeek: 3,
  sessionMinutes: 60,
  cardioPreference: 1,
  experience: "beginner",
  equipment: ["bodyweight", "dumbbells", "cable", "treadmill"],
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

  it("materially changes programming for different goals", () => {
    const equipment = [
      ...input.equipment,
      "treadmill",
      "bike",
      "elliptical",
    ];
    const strength = generatePlanWithQuality(
      { ...input, equipment, goals: [{ code: "strength", priority: 1 }] },
      diverseCatalog,
    );
    const conditioning = generatePlanWithQuality(
      {
        ...input,
        equipment,
        goals: [{ code: "conditioning", priority: 1 }],
      },
      diverseCatalog,
    );
    expect(strength.days).not.toEqual(conditioning.days);
    expect(strength.quality.goalAlignment.status).toBe("PASS");
    expect(conditioning.quality.goalAlignment.status).toBe("PASS");
    expect(strength.quality.goalAlignment.lowerRepStrengthSlots).toBeGreaterThan(0);
    expect(conditioning.quality.goalAlignment.cardioSlots).toBe(3);
  });

  it("uses capability groups while respecting permanent equipment exceptions", () => {
    const machine = {
      ...candidate("capability-row", "horizontal_pull", ["row-machine"]),
      capabilities: ["horizontal_pull"],
    };
    const capabilityInput: PlanInput = {
      ...input,
      equipment: [],
      capabilities: ["bodyweight", "horizontal_pull"],
      gymProfile: "STANDARD_COMMERCIAL_GYM",
    };
    expect(isExerciseEligible(machine, capabilityInput)).toBe(true);
    expect(
      isExerciseEligible(machine, {
        ...capabilityInput,
        unavailableEquipment: ["row-machine"],
      }),
    ).toBe(false);
  });

  it("keeps every supported goal aligned across every supported frequency", () => {
    const equipment = [
      ...input.equipment,
      "treadmill",
      "bike",
      "elliptical",
    ];
    for (const goal of [
      "general_health",
      "strength",
      "muscle_gain",
      "conditioning",
      "mobility",
      "posture",
    ] as const) {
      for (const sessionsPerWeek of [2, 3, 4, 5] as const) {
        let result;
        try {
          result = generatePlanWithQuality(
            {
              ...input,
              equipment,
              goals: [{ code: goal, priority: 1 }],
              sessionsPerWeek,
              sessionMinutes: sessionsPerWeek === 3 ? 60 : 45,
              cardioPreference: goal === "conditioning" ? 4 : 2,
            },
            diverseCatalog,
          );
        } catch (error) {
          if (error instanceof PlanConstraintError)
            throw new Error(
              `${goal}/${sessionsPerWeek}: ${JSON.stringify(error.diagnostics)}`,
            );
          throw error;
        }
        expect(
          result.quality.goalAlignment.status,
          `${goal}/${sessionsPerWeek}`,
        ).toBe("PASS");
      }
    }
  });
});

const gymCatalog: ExerciseCandidate[] = [
  ["leg-press", "squat", "commercial_machine", 1, "low"],
  ["hack-squat", "squat", "commercial_machine", 1, "moderate"],
  ["barbell-squat", "squat", "commercial_free_weight", 2, "high"],
  ["machine-row", "horizontal_pull", "commercial_machine", 1, "low"],
  ["cable-row", "horizontal_pull", "commercial_cable", 1, "low"],
  ["barbell-row", "horizontal_pull", "commercial_free_weight", 2, "high"],
  ["leg-curl", "knee_flexion", "commercial_machine", 1, "low"],
  ["hip-machine", "hip_extension", "commercial_machine", 1, "low"],
  ["deadlift", "hinge", "commercial_free_weight", 2, "high"],
  ["machine-press", "horizontal_push", "commercial_machine", 1, "low"],
  ["incline-machine", "horizontal_push", "commercial_machine", 1, "low"],
  ["bench-press", "horizontal_push", "commercial_free_weight", 2, "moderate"],
  ["shoulder-machine", "vertical_push", "commercial_machine", 1, "low"],
  ["dumbbell-press", "vertical_push", "commercial_free_weight", 2, "moderate"],
  ["lat-pulldown", "vertical_pull", "commercial_machine", 1, "low"],
  ["neutral-pulldown", "vertical_pull", "commercial_machine", 1, "low"],
  ["pull-up", "vertical_pull", "bodyweight_station", 3, "moderate"],
  ["leg-extension", "knee_extension", "commercial_machine", 1, "low"],
  ["pallof", "core_anti_rotation", "commercial_cable", 1, "low"],
  ["plank", "core_anti_extension", "bodyweight_floor", 3, "low"],
  ["side-plank", "core_anti_rotation", "bodyweight_floor", 3, "low"],
  ["superman", "posture", "bodyweight_floor", 3, "low"],
] .map(([id, pattern, environmentProfile, gymEquipmentTier, technicalComplexity]) => ({
  ...candidate(id as string, pattern as string),
  equipment: [],
  trainingRole: pattern === "posture" ? "postural_control" : (pattern as string),
  environmentProfile: environmentProfile as ExerciseCandidate["environmentProfile"],
  gymEquipmentTier: gymEquipmentTier as ExerciseCandidate["gymEquipmentTier"],
  technicalComplexity: technicalComplexity as ExerciseCandidate["technicalComplexity"],
  goalSuitability: ["muscle_gain", "strength", "general_health"],
}));

const gymFirstInput: PlanInput = {
  ...input,
  goals: [{ code: "muscle_gain", priority: 1 }],
  gymProfile: "STANDARD_COMMERCIAL_GYM",
  workoutStyle: "gym_first",
  equipment: [],
};

describe("generatePlan v2.1.5 gym-first", () => {
  it("ranks a comparable machine above bodyweight for gym-first muscle gain", () => {
    const machine = gymCatalog.find((exercise) => exercise.id === "lat-pulldown")!;
    const bodyweight = gymCatalog.find((exercise) => exercise.id === "pull-up")!;
    expect(scoreExercise(machine, gymFirstInput)).toBeGreaterThan(
      scoreExercise(bodyweight, gymFirstInput),
    );
  });

  it("builds a commercial-gym muscle-gain preview that passes every hard gate", () => {
    const result = generatePlanWithQuality(gymFirstInput, gymCatalog);
    expect(result.generatorVersion).toBe("v2.1.5");
    expect(result.quality.gymEquipmentPercent).toBeGreaterThanOrEqual(70);
    expect(result.quality.bodyweightPercent).toBeLessThanOrEqual(20);
    expect(result.quality.bodyweightFloorSlots).toBeLessThanOrEqual(2);
    expect(result.quality.bodyweightFloorSlotsByDay.every((count) => count <= 1)).toBe(true);
    expect(result.quality.corePostureSlots).toBeLessThanOrEqual(2);
    expect(result.quality.mediaCoveragePercent).toBe(100);
    expect(result.quality.goalAlignment.status).toBe("PASS");
    expect(result.quality.uniqueExercises).toBeGreaterThanOrEqual(12);
  });

  it("keeps strength meaningfully more open to free-weight compounds", () => {
    const hypertrophy = generatePlanWithQuality(gymFirstInput, gymCatalog);
    const strength = generatePlanWithQuality(
      { ...gymFirstInput, goals: [{ code: "strength", priority: 1 }] },
      gymCatalog,
    );
    expect(strength.quality.freeWeightSlots).toBeGreaterThanOrEqual(
      hypertrophy.quality.freeWeightSlots,
    );
  });

  it("returns GYM_FIRST_CONSTRAINT instead of emitting a floor-dominant plan", () => {
    const floorCatalog = diverseCatalog.map((exercise) => ({
      ...exercise,
      environmentProfile: "bodyweight_floor" as const,
      gymEquipmentTier: 3 as const,
      technicalComplexity: "low" as const,
      goalSuitability: ["muscle_gain" as const],
      equipment: [],
    }));
    expect(() => generatePlanWithQuality(gymFirstInput, floorCatalog)).toThrowError(
      expect.objectContaining({
        diagnostics: expect.arrayContaining([
          expect.objectContaining({ code: "GYM_FIRST_CONSTRAINT" }),
        ]),
      }),
    );
  });
});
