import type { ExerciseCandidate, GeneratedDay, PlanQualityMetrics } from "../types";
import { determinismKey, exerciseFamily } from "./plan-compiler.ts";

export function enrichProgramQuality(
  quality: PlanQualityMetrics,
  days: GeneratedDay[],
  catalog: ExerciseCandidate[],
  catalogVersion?: string,
  expectedFrequency?: number,
): PlanQualityMetrics {
  const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  const familyFrequency: Record<string, number> = {};
  const muscleFrequency: Record<string, number> = {};
  const roleDistribution: NonNullable<PlanQualityMetrics["roleDistribution"]> = {};
  const weeklyVolumeSets: Record<string, number> = {};
  let orderingStatus: "PASS" | "FAIL" = "PASS";

  for (const day of days) {
    let sawAccessory = false;
    for (const item of day.exercises) {
      const exercise = byId.get(item.exerciseId);
      if (!exercise) continue;
      const family = exerciseFamily(exercise);
      familyFrequency[family] = (familyFrequency[family] ?? 0) + 1;
      for (const muscle of exercise.primaryMuscles ?? []) {
        muscleFrequency[muscle] = (muscleFrequency[muscle] ?? 0) + 1;
        weeklyVolumeSets[muscle] = (weeklyVolumeSets[muscle] ?? 0) + item.sets;
      }
      if (item.slotRole) {
        roleDistribution[item.slotRole] = (roleDistribution[item.slotRole] ?? 0) + 1;
        const isPrimary = item.slotRole.startsWith("PRIMARY");
        if (sawAccessory && isPrimary) orderingStatus = "FAIL";
        if (["ACCESSORY", "ISOLATION", "CORE", "CONDITIONING", "MOBILITY", "CORRECTIVE"].includes(item.slotRole))
          sawAccessory = true;
      }
    }
  }
  const push = (quality.movementPatternDistribution.horizontal_push ?? 0) +
    (quality.movementPatternDistribution.vertical_push ?? 0);
  const pull = (quality.movementPatternDistribution.horizontal_pull ?? 0) +
    (quality.movementPatternDistribution.vertical_pull ?? 0);
  const lower = ["squat", "hinge", "hip_extension", "knee_extension", "knee_flexion"]
    .reduce((sum, pattern) => sum + (quality.movementPatternDistribution[pattern] ?? 0), 0);
  const lowerMinimum = Math.max(2, Math.ceil(days.length * 0.8));
  const pushPullTolerance = Math.max(2, Math.ceil((push + pull) * 0.35));
  const weeklyBalanceStatus = Math.abs(push - pull) <= pushPullTolerance && lower >= lowerMinimum
    ? "PASS"
    : "FAIL";
  const resistanceSets = days.flatMap((day) => day.exercises)
    .filter((item) => !item.targetDurationSeconds)
    .reduce((sum, item) => sum + item.sets, 0);
  const resistanceSlots = days.flatMap((day) => day.exercises)
    .filter((item) => !item.targetDurationSeconds).length;
  const volumeValidationStatus = resistanceSlots > 0 &&
    resistanceSets >= resistanceSlots * 2 &&
    resistanceSets <= resistanceSlots * 5
    ? "PASS"
    : "FAIL";
  const frequencyValidationStatus = days.length > 0 &&
    days.length === (expectedFrequency ?? days.length) &&
    days.every((day) => day.exercises.length > 0)
    ? "PASS"
    : "FAIL";
  const functionalRepetitionStatus = days.every((day) => {
    const families = day.exercises
      .map((item) => byId.get(item.exerciseId))
      .filter((exercise): exercise is ExerciseCandidate => Boolean(exercise))
      .map(exerciseFamily);
    const counts = families.map((family) => families.filter((item) => item === family).length);
    return Math.max(0, ...counts) <= 2;
  }) ? "PASS" : "FAIL";
  return {
    ...quality,
    exerciseFamilyFrequency: sortRecord(familyFrequency),
    muscleFrequency: sortRecord(muscleFrequency),
    roleDistribution,
    weeklyVolumeSets: sortRecord(weeklyVolumeSets),
    volumeValidationStatus,
    frequencyValidationStatus,
    functionalRepetitionStatus,
    weeklyBalanceStatus,
    orderingStatus,
    programQualityStatus:
      weeklyBalanceStatus === "PASS" &&
      volumeValidationStatus === "PASS" &&
      frequencyValidationStatus === "PASS" &&
      functionalRepetitionStatus === "PASS" &&
      orderingStatus === "PASS" &&
      quality.goalAlignment.status === "PASS"
        ? "PASS"
        : "FAIL",
    determinismKey: determinismKey(days, catalogVersion),
  };
}

function sortRecord(record: Record<string, number>) {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}
