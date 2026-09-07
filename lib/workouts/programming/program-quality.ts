import type { ExerciseCandidate, GeneratedDay, PlanInput, PlanQualityMetrics, TrainingSlot } from "../types";
import { determinismKey, exerciseFamily } from "./plan-compiler.ts";

export function enrichProgramQuality(
  quality: PlanQualityMetrics,
  days: GeneratedDay[],
  catalog: ExerciseCandidate[],
  catalogVersion?: string,
  expectedFrequency?: number,
  slots: TrainingSlot[] = [],
  prunedSlots: TrainingSlot[] = [],
  input?: PlanInput,
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
  const fillerSlots = slots.filter(
    (slot) => slot.requirement === "OPTIONAL" && slot.programmingValue < slot.minimumProgrammingValue,
  ).length;
  const unjustifiedCorrectiveSlots = slots.filter(
    (slot) => slot.role === "CORRECTIVE" &&
      (slot.needStatus === "COVERED" || slot.programmingValue < slot.minimumProgrammingValue),
  ).length;
  const slotJustificationStatus = fillerSlots === 0 &&
    unjustifiedCorrectiveSlots === 0 &&
    slots.every((slot) => slot.need && slot.justification.trim().length > 0)
    ? "PASS"
    : "FAIL";
  const functionalCoverageStatus = days.every((day, dayIndex) =>
    slots.filter((slot) => slot.dayIndex === dayIndex && slot.requirement === "REQUIRED").length >= Math.min(4, day.exercises.length),
  ) && weeklyBalanceStatus === "PASS" ? "PASS" : "FAIL";
  const estimatedSessionMinutesByDay = days.map((_, dayIndex) =>
    slots.filter((slot) => slot.dayIndex === dayIndex).reduce((sum, slot) => sum + slot.estimatedTimeMinutes, 0),
  );
  const sessionEfficiencyStatus = fillerSlots === 0 &&
    estimatedSessionMinutesByDay.every((minutes) => minutes <= (input?.sessionMinutes ?? minutes) * 1.15)
    ? "PASS"
    : "FAIL";
  const averageProgrammingValue = slots.length
    ? Number((slots.reduce((sum, slot) => sum + slot.programmingValue, 0) / slots.length).toFixed(1))
    : 0;
  const selectedExercises = days.flatMap((day) => day.exercises)
    .map((item) => byId.get(item.exerciseId))
    .filter((exercise): exercise is ExerciseCandidate => Boolean(exercise));
  const poorEnvironmentFit = input?.gymProfile === "STANDARD_COMMERCIAL_GYM" &&
    (input.workoutStyle ?? "gym_first") === "gym_first" &&
    selectedExercises.some((exercise) => {
      const postureUnsupportedFreeWeight = input.goals
        .slice()
        .sort((left, right) => left.priority - right.priority || left.code.localeCompare(right.code))[0]?.code === "posture" &&
        exercise.environmentProfile === "commercial_free_weight" &&
        (exercise.technicalComplexity === "high" || exercise.stabilityProfile !== "high");
      const avoidableFloorExercise = exercise.environmentProfile === "bodyweight_floor" &&
      input.preferences?.[exercise.id] !== "like" &&
      catalog.some((alternative) =>
        alternative.id !== exercise.id &&
        alternative.active &&
        alternative.autoPlanEligible !== false &&
        alternative.mediaReady !== false &&
        alternative.pattern === exercise.pattern &&
        ["commercial_machine", "commercial_cable", "commercial_free_weight"].includes(alternative.environmentProfile ?? ""),
      );
      return postureUnsupportedFreeWeight || avoidableFloorExercise;
    });
  const environmentContextFitStatus = poorEnvironmentFit ? "FAIL" : "PASS";
  return {
    ...quality,
    exerciseFamilyFrequency: sortRecord(familyFrequency),
    muscleFrequency: sortRecord(muscleFrequency),
    roleDistribution,
    weeklyVolumeSets: sortRecord(weeklyVolumeSets),
    volumeValidationStatus,
    frequencyValidationStatus,
    functionalRepetitionStatus,
    functionalCoverageStatus,
    slotJustificationStatus,
    sessionEfficiencyStatus,
    fillerSlots,
    unjustifiedCorrectiveSlots,
    optionalSlotsPruned: prunedSlots.length,
    estimatedSessionMinutesByDay,
    averageProgrammingValue,
    environmentContextFitStatus,
    weeklyBalanceStatus,
    orderingStatus,
    programQualityStatus:
      weeklyBalanceStatus === "PASS" &&
      volumeValidationStatus === "PASS" &&
      frequencyValidationStatus === "PASS" &&
      functionalRepetitionStatus === "PASS" &&
      functionalCoverageStatus === "PASS" &&
      slotJustificationStatus === "PASS" &&
      sessionEfficiencyStatus === "PASS" &&
      environmentContextFitStatus === "PASS" &&
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
