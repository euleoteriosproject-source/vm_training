import type {
  ExerciseCandidate,
  GeneratedDay,
  GeneratedPlan,
  PlanConstraintDiagnostic,
  PlanInput,
  PlanQualityMetrics,
} from "./types";

export const GENERATOR_VERSION = "v2.1.1";

const splits: Record<number, string[]> = {
  2: ["Full Body A", "Full Body B"],
  3: ["Full Body A", "Full Body B", "Full Body C"],
  4: ["Upper A", "Lower A", "Upper B", "Lower B"],
  5: ["Upper", "Lower", "Mixed", "Upper + Core", "Lower + Cardio"],
};

const upperPatterns = new Set([
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "posture",
]);
const lowerPatterns = new Set([
  "squat",
  "hinge",
  "hip_extension",
  "knee_extension",
  "knee_flexion",
]);

const balancedThreeDayPatternSlots: readonly (readonly (readonly string[])[])[] = [
  [
    ["squat"],
    ["horizontal_pull"],
    ["knee_flexion", "hinge", "hip_extension"],
    ["vertical_push"],
    ["carry", "core_anti_extension"],
    ["horizontal_push"],
  ],
  [
    ["hip_extension", "hinge"],
    ["vertical_pull"],
    ["knee_extension", "squat"],
    ["horizontal_push"],
    ["core_anti_rotation", "core_anti_extension"],
    ["posture"],
  ],
  [
    ["squat"],
    ["horizontal_pull"],
    ["vertical_push"],
    ["vertical_pull"],
    ["core_anti_extension"],
    ["mobility", "posture"],
  ],
];

const conditioningThreeDayPatternSlots: typeof balancedThreeDayPatternSlots = [
  [["squat"], ["horizontal_pull"], ["horizontal_push"], ["hinge", "hip_extension"], ["core_anti_extension", "carry"], ["cardio"]],
  [["knee_extension", "squat"], ["vertical_pull"], ["vertical_push"], ["knee_flexion", "hinge"], ["core_anti_rotation", "posture"], ["cardio"]],
  [["squat", "hip_extension"], ["horizontal_pull"], ["horizontal_push"], ["vertical_pull"], ["mobility", "core_anti_extension"], ["cardio"]],
];

const healthThreeDayPatternSlots: typeof balancedThreeDayPatternSlots = [
  balancedThreeDayPatternSlots[0],
  balancedThreeDayPatternSlots[1],
  [
    ["squat"],
    ["horizontal_pull"],
    ["vertical_push"],
    ["vertical_pull"],
    ["core_anti_extension"],
    ["cardio"],
  ],
];

const mobilityThreeDayPatternSlots: typeof balancedThreeDayPatternSlots = [
  [["squat"], ["horizontal_pull"], ["horizontal_push"], ["core_anti_extension"], ["posture"], ["mobility", "posture"]],
  [["hinge", "hip_extension"], ["vertical_pull"], ["vertical_push"], ["core_anti_rotation"], ["posture"], ["mobility", "posture"]],
  [["knee_extension", "squat"], ["horizontal_pull"], ["horizontal_push"], ["knee_flexion"], ["posture"], ["mobility", "posture"]],
];

function primaryGoal(input: PlanInput) {
  return [...input.goals].sort(
    (left, right) => left.priority - right.priority || left.code.localeCompare(right.code),
  )[0]?.code ?? "general_health";
}

function threeDaySlotsForGoal(input: PlanInput) {
  const goal = primaryGoal(input);
  if (["conditioning", "cardio_endurance", "fat_loss", "weight_loss", "measurements"].includes(goal))
    return conditioningThreeDayPatternSlots;
  if (["mobility", "posture"].includes(goal)) return mobilityThreeDayPatternSlots;
  if (goal === "general_health") return healthThreeDayPatternSlots;
  return balancedThreeDayPatternSlots;
}

export class PlanConstraintError extends Error {
  public readonly diagnostics: PlanConstraintDiagnostic[];

  constructor(diagnostics: PlanConstraintDiagnostic[]) {
    super(diagnostics.map((item) => item.message).join(" "));
    this.name = "PlanConstraintError";
    this.diagnostics = diagnostics;
  }
}

function percentage(value: number, total: number) {
  return total ? Number(((value / total) * 100).toFixed(1)) : 0;
}

function isMediaReady(exercise: ExerciseCandidate) {
  return exercise.mediaReady ?? exercise.hasApprovedMedia;
}

export function isExerciseEligible(
  exercise: ExerciseCandidate,
  input: PlanInput,
) {
  if (!exercise.active || !isMediaReady(exercise)) return false;
  if (exercise.autoPlanEligible === false) return false;
  if (input.preferences?.[exercise.id] === "avoid") return false;
  if (input.experience === "beginner" && exercise.difficulty === "advanced")
    return false;
  if (input.movementAttentionPatterns?.includes(exercise.pattern)) return false;
  return hasCompatibleEquipment(exercise, input);
}

function hasCompatibleEquipment(
  exercise: ExerciseCandidate,
  input: PlanInput,
) {
  if (
    exercise.equipment.some((item) =>
      input.unavailableEquipment?.includes(item),
    )
  )
    return false;
  if (exercise.capabilities?.length && input.capabilities?.length)
    return exercise.capabilities.every((capability) =>
      input.capabilities!.includes(capability),
    );
  return exercise.equipment.every(
    (item) => item === "bodyweight" || input.equipment.includes(item),
  );
}

function scoreExercise(exercise: ExerciseCandidate, input: PlanInput) {
  let score = 10;
  const goals = new Map(
    input.goals.map((goal) => [goal.code, 11 - goal.priority]),
  );
  if (
    goals.has("posture") &&
    ["horizontal_pull", "vertical_pull", "posture", "hinge"].includes(
      exercise.pattern,
    )
  )
    score += goals.get("posture")! * 3;
  if (goals.has("strength") && exercise.category === "strength")
    score += goals.get("strength")! * 2;
  if (goals.has("muscle_gain") && exercise.category === "strength")
    score += goals.get("muscle_gain")! * 2;
  if (goals.has("mobility") && exercise.category === "mobility")
    score += goals.get("mobility")! * 4;
  if (
    goals.has("general_health") &&
    ["strength", "cardio", "mobility"].includes(exercise.category)
  )
    score += goals.get("general_health")!;
  if (
    (goals.has("conditioning") ||
      goals.has("fat_loss") ||
      goals.has("weight_loss")) &&
    exercise.category === "cardio"
  )
    score += input.cardioPreference * 4;
  const preference = input.preferences?.[exercise.id];
  if (preference === "like") score += 8;
  if (preference === "dislike") score -= 8;
  if (input.recentExerciseIds?.includes(exercise.id)) score -= 6;
  return score;
}

function overlap(left: Set<string>, right: Set<string>) {
  const denominator = Math.min(left.size, right.size);
  if (!denominator) return 0;
  const shared = [...left].filter((id) => right.has(id)).length;
  return percentage(shared, denominator);
}

export function evaluatePlanQuality(
  days: GeneratedDay[],
  catalog: ExerciseCandidate[],
  input: PlanInput,
): PlanQualityMetrics {
  const catalogById = new Map(
    catalog.map((exercise) => [exercise.id, exercise]),
  );
  const slots = days.flatMap((day) => day.exercises);
  const frequencies = new Map<string, number>();
  for (const slot of slots)
    frequencies.set(
      slot.exerciseId,
      (frequencies.get(slot.exerciseId) ?? 0) + 1,
    );
  const daySets = days.map(
    (day) => new Set(day.exercises.map((exercise) => exercise.exerciseId)),
  );
  const dayPairOverlapPercent: Record<string, number> = {};
  for (let left = 0; left < days.length; left++)
    for (let right = left + 1; right < days.length; right++)
      dayPairOverlapPercent[`${days[left].name} x ${days[right].name}`] =
        overlap(daySets[left], daySets[right]);
  const patterns = slots
    .map((slot) => catalogById.get(slot.exerciseId)?.pattern)
    .filter((pattern): pattern is string => Boolean(pattern));
  const movementPatternDistribution = Object.fromEntries(
    [...new Set(patterns)]
      .sort()
      .map((pattern) => [
        pattern,
        patterns.filter((candidate) => candidate === pattern).length,
      ]),
  );
  const invalidEquipment = [
    ...new Set(
      slots
        .filter((slot) => {
          const exercise = catalogById.get(slot.exerciseId);
          return (
            !exercise ||
            !hasCompatibleEquipment(exercise, input)
          );
        })
        .map((slot) => slot.exerciseId),
    ),
  ];
  const ineligibleExercises = [
    ...new Set(
      slots
        .filter((slot) => {
          const exercise = catalogById.get(slot.exerciseId);
          return !exercise || !isExerciseEligible(exercise, input);
        })
        .map((slot) => slot.exerciseId),
    ),
  ];
  const mediaReadyCount = slots.filter((slot) => {
    const exercise = catalogById.get(slot.exerciseId);
    return exercise ? isMediaReady(exercise) : false;
  }).length;

  const goalAlignment = evaluateGoalAlignment(days, catalog, input);

  return {
    totalSlots: slots.length,
    uniqueExercises: frequencies.size,
    uniquenessPercent: percentage(frequencies.size, slots.length),
    maxExactExerciseFrequency: Math.max(0, ...frequencies.values()),
    exactExerciseOnAllDays: [...frequencies]
      .filter(([, frequency]) => frequency >= days.length)
      .map(([id]) => id)
      .sort(),
    dayPairOverlapPercent,
    movementPatternCount: Object.keys(movementPatternDistribution).length,
    movementPatternDistribution,
    mediaCoveragePercent: percentage(mediaReadyCount, slots.length),
    invalidEquipment,
    ineligibleExercises,
    goalAlignment,
  };
}

export function evaluateGoalAlignment(
  days: GeneratedDay[],
  catalog: ExerciseCandidate[],
  input: PlanInput,
): PlanQualityMetrics["goalAlignment"] {
  const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  const slots = days.flatMap((day) => day.exercises);
  const strengthSlots = slots.filter(
    (slot) => byId.get(slot.exerciseId)?.category === "strength",
  );
  const cardioSlots = slots.filter(
    (slot) => byId.get(slot.exerciseId)?.category === "cardio",
  ).length;
  const mobilityOrPostureSlots = slots.filter((slot) => {
    const exercise = byId.get(slot.exerciseId);
    return exercise?.category === "mobility" || exercise?.pattern === "posture";
  }).length;
  const lowerRepStrengthSlots = strengthSlots.filter(
    (slot) => slot.repMax > 0 && slot.repMax <= 8,
  ).length;
  const moderateRepStrengthSlots = strengthSlots.filter(
    (slot) => slot.repMin >= 8 && slot.repMax <= 15,
  ).length;
  const longRestStrengthSlots = strengthSlots.filter(
    (slot) => slot.restSeconds >= 105,
  ).length;
  const goal = primaryGoal(input);
  const reasons: string[] = [];
  const ratio = (value: number, total: number) => (total ? value / total : 0);

  if (goal === "strength") {
    if (ratio(strengthSlots.length, slots.length) < 0.75) reasons.push("strength_volume");
    if (ratio(lowerRepStrengthSlots, strengthSlots.length) < 0.5) reasons.push("strength_reps");
    if (ratio(longRestStrengthSlots, strengthSlots.length) < 0.5) reasons.push("strength_rest");
  } else if (goal === "muscle_gain") {
    if (ratio(strengthSlots.length, slots.length) < 0.75) reasons.push("hypertrophy_volume");
    if (ratio(moderateRepStrengthSlots, strengthSlots.length) < 0.7) reasons.push("hypertrophy_reps");
  } else if (["conditioning", "cardio_endurance", "fat_loss", "weight_loss", "measurements"].includes(goal)) {
    if (cardioSlots < days.length) reasons.push("conditioning_cardio");
    if (strengthSlots.length < days.length * 2) reasons.push("conditioning_strength_foundation");
  } else if (["mobility", "posture"].includes(goal)) {
    if (mobilityOrPostureSlots < days.length) reasons.push("movement_quality_volume");
    if (strengthSlots.length < days.length * 3) reasons.push("movement_quality_strength_foundation");
  } else {
    if (strengthSlots.length < days.length * 3) reasons.push("health_strength_foundation");
    if (days.length >= 3 && mobilityOrPostureSlots < 1) reasons.push("health_movement_quality");
    if (days.length >= 3 && cardioSlots < 1) reasons.push("health_conditioning");
  }

  return {
    status: reasons.length ? "FAIL" : "PASS",
    goal,
    strengthSlots: strengthSlots.length,
    cardioSlots,
    mobilityOrPostureSlots,
    lowerRepStrengthSlots,
    moderateRepStrengthSlots,
    longRestStrengthSlots,
    reasons,
  };
}

function qualityDiagnostics(
  quality: PlanQualityMetrics,
  standardThreeDayPlan: boolean,
): PlanConstraintDiagnostic[] {
  const diagnostics: PlanConstraintDiagnostic[] = [];
  if (quality.mediaCoveragePercent !== 100)
    diagnostics.push({
      code: "INCOMPLETE_MEDIA_COVERAGE",
      message: "O plano não possui cobertura de mídia completa.",
      actual: quality.mediaCoveragePercent,
      required: 100,
    });
  if (quality.invalidEquipment.length)
    diagnostics.push({
      code: "INVALID_EQUIPMENT",
      message: "O plano contém equipamento indisponível.",
      actual: quality.invalidEquipment,
      required: 0,
    });
  if (quality.ineligibleExercises.length)
    diagnostics.push({
      code: "INELIGIBLE_EXERCISE",
      message: "O plano contém exercício inelegível.",
      actual: quality.ineligibleExercises,
      required: 0,
    });
  if (quality.goalAlignment.status !== "PASS")
    diagnostics.push({
      code: "GOAL_MISALIGNED",
      message: "O plano não reflete materialmente o objetivo selecionado.",
      actual: quality.goalAlignment.reasons,
      required: "PASS",
    });
  if (standardThreeDayPlan && quality.uniqueExercises < 12)
    diagnostics.push({
      code: "INSUFFICIENT_UNIQUE_EXERCISES",
      message: "O pool compatível não permite 12 exercícios únicos.",
      actual: quality.uniqueExercises,
      required: 12,
    });
  if (standardThreeDayPlan && quality.exactExerciseOnAllDays.length)
    diagnostics.push({
      code: "EXERCISE_ON_ALL_DAYS",
      message: "Um mesmo exercício foi selecionado nos três dias.",
      actual: quality.exactExerciseOnAllDays,
      required: 0,
    });
  const excessivePairs = Object.entries(quality.dayPairOverlapPercent)
    .filter(([, value]) => value > 50)
    .map(([pair]) => pair);
  if (standardThreeDayPlan && excessivePairs.length)
    diagnostics.push({
      code: "EXCESSIVE_DAY_OVERLAP",
      message: "A sobreposição entre dias excede 50%.",
      actual: excessivePairs,
      required: "<= 50%",
    });
  if (standardThreeDayPlan && quality.movementPatternCount < 8)
    diagnostics.push({
      code: "INSUFFICIENT_MOVEMENT_COVERAGE",
      message: "O plano não alcança oito padrões de movimento.",
      actual: quality.movementPatternCount,
      required: 8,
    });
  return diagnostics;
}

function createPrescription(exercise: ExerciseCandidate, input: PlanInput) {
  const goal = primaryGoal(input);
  const strengthGoal = goal === "strength";
  const hypertrophyGoal = goal === "muscle_gain";
  const conditioningGoal = [
    "conditioning",
    "cardio_endurance",
    "fat_loss",
    "weight_loss",
    "measurements",
  ].includes(goal);
  if (exercise.category === "cardio")
    return {
      exerciseId: exercise.id,
      sets: 1,
      repMin: 0,
      repMax: 0,
      restSeconds: 0,
      targetDurationSeconds: Math.max(
        300,
        input.sessionMinutes * 60 * (conditioningGoal ? 0.24 : 0.15),
      ),
    };
  return {
    exerciseId: exercise.id,
    sets: strengthGoal ? 4 : hypertrophyGoal ? 4 : 3,
    repMin: strengthGoal ? 4 : hypertrophyGoal ? 8 : 8,
    repMax: strengthGoal ? 7 : hypertrophyGoal ? 12 : 12,
    restSeconds: strengthGoal ? 135 : hypertrophyGoal ? 90 : conditioningGoal ? 60 : 75,
  };
}

function generateDiverseThreeDayPlan(
  input: PlanInput,
  eligible: Array<{ exercise: ExerciseCandidate; score: number }>,
) {
  if (eligible.length < 12)
    throw new PlanConstraintError([
      {
        code: "INSUFFICIENT_ELIGIBLE_POOL",
        message: "O pool compatível tem menos de 12 exercícios elegíveis.",
        actual: eligible.length,
        required: 12,
      },
    ]);

  const targetUnique = Math.min(15, eligible.length, 14);
  const usage = new Map<string, number>();
  const usedDays = new Map<string, Set<number>>();
  const selectedDays: ExerciseCandidate[][] = [];

  for (let dayIndex = 0; dayIndex < 3; dayIndex++) {
    const selected: ExerciseCandidate[] = [];
    for (const patterns of threeDaySlotsForGoal(input)[dayIndex]) {
      const matching = eligible.filter(({ exercise }) =>
        patterns.includes(exercise.pattern),
      );
      const pool = matching.length ? matching : eligible;
      const dayIds = new Set(selected.map((exercise) => exercise.id));
      const candidates = pool
        .filter(({ exercise }) => !dayIds.has(exercise.id))
        .filter(({ exercise }) => (usage.get(exercise.id) ?? 0) < 2)
        .filter(({ exercise }) => {
          const priorDays = usedDays.get(exercise.id) ?? new Set<number>();
          return [...priorDays].every((priorDay) => {
            const priorIds = new Set(
              selectedDays[priorDay]?.map((candidate) => candidate.id) ?? [],
            );
            const currentIds = new Set(
              selected.map((candidate) => candidate.id),
            );
            const shared = [...currentIds].filter((id) =>
              priorIds.has(id),
            ).length;
            return shared + (priorIds.has(exercise.id) ? 1 : 0) <= 3;
          });
        })
        .sort((left, right) => {
          const leftUsage = usage.get(left.exercise.id) ?? 0;
          const rightUsage = usage.get(right.exercise.id) ?? 0;
          const preferUnused = usage.size < targetUnique;
          if (preferUnused && (leftUsage === 0) !== (rightUsage === 0))
            return leftUsage === 0 ? -1 : 1;
          if (!preferUnused && (leftUsage === 1) !== (rightUsage === 1))
            return leftUsage === 1 ? -1 : 1;
          return (
            leftUsage - rightUsage ||
            right.score - left.score ||
            left.exercise.id.localeCompare(right.exercise.id)
          );
        });
      const chosen = candidates[0];
      if (!chosen)
        throw new PlanConstraintError([
          {
            code: "INSUFFICIENT_ELIGIBLE_POOL",
            message: "Não existe seleção compatível para todos os slots.",
            actual: usage.size,
            required: 12,
          },
        ]);
      selected.push(chosen.exercise);
      usage.set(chosen.exercise.id, (usage.get(chosen.exercise.id) ?? 0) + 1);
      const days = usedDays.get(chosen.exercise.id) ?? new Set<number>();
      days.add(dayIndex);
      usedDays.set(chosen.exercise.id, days);
    }
    selectedDays.push(selected);
  }

  return selectedDays.map((exercises, index) => ({
    name: splits[3][index],
    estimatedMinutes: input.sessionMinutes,
    exercises: exercises.map((exercise) => createPrescription(exercise, input)),
  }));
}

function generateLegacySplit(
  input: PlanInput,
  eligible: Array<{ exercise: ExerciseCandidate; score: number }>,
): GeneratedDay[] {
  if (eligible.length < 4)
    throw new PlanConstraintError([
      {
        code: "INSUFFICIENT_ELIGIBLE_POOL",
        message:
          "Catálogo com demonstrações aprovadas insuficiente para gerar um plano seguro.",
        actual: eligible.length,
        required: 4,
      },
    ]);
  const goal = primaryGoal(input);
  const conditioningGoal = [
    "conditioning",
    "cardio_endurance",
    "fat_loss",
    "weight_loss",
    "measurements",
  ].includes(goal);
  const movementQualityGoal = ["mobility", "posture"].includes(goal);
  const healthGoal = goal === "general_health";
  const highCardio = input.cardioPreference >= 4 && conditioningGoal;
  const strengthCount = highCardio
    ? Math.max(2, Math.floor((input.sessionMinutes * 0.35) / 7))
    : Math.max(3, Math.floor((input.sessionMinutes * 0.72) / 7));
  const cardioMinutes = highCardio
    ? Math.round(input.sessionMinutes * 0.65)
    : conditioningGoal || healthGoal || input.cardioPreference >= 3
      ? Math.max(10, Math.round(input.sessionMinutes * 0.22))
      : 0;
  const used = new Map<string, number>();

  return splits[input.sessionsPerWeek].map((name, dayIndex) => {
    const focus = name.startsWith("Upper")
      ? upperPatterns
      : name.startsWith("Lower")
        ? lowerPatterns
        : null;
    const resistance = eligible.filter(
      ({ exercise }) =>
        exercise.category === "strength" &&
        (!focus || focus.has(exercise.pattern)),
    );
    const selected = [...resistance]
      .sort(
        (left, right) =>
          (used.get(left.exercise.id) ?? 0) -
            (used.get(right.exercise.id) ?? 0) ||
          right.score - left.score ||
          left.exercise.id.localeCompare(right.exercise.id),
      )
      .slice(0, strengthCount)
      .map(({ exercise }) => {
        used.set(exercise.id, (used.get(exercise.id) ?? 0) + 1);
        return createPrescription(exercise, input);
      });
    if (movementQualityGoal) {
      const selectedIds = new Set(selected.map((item) => item.exerciseId));
      const movementQuality = eligible
        .filter(
          ({ exercise }) =>
            exercise.category === "mobility" || exercise.pattern === "posture",
        )
        .filter(({ exercise }) => !selectedIds.has(exercise.id))
        .sort(
          (left, right) =>
            (used.get(left.exercise.id) ?? 0) -
              (used.get(right.exercise.id) ?? 0) ||
            right.score - left.score ||
            left.exercise.id.localeCompare(right.exercise.id),
        )[0]?.exercise;
      if (movementQuality) {
        selected.push(createPrescription(movementQuality, input));
        used.set(
          movementQuality.id,
          (used.get(movementQuality.id) ?? 0) + 1,
        );
      }
    }
    const cardio = eligible.filter(
      ({ exercise }) => exercise.category === "cardio",
    );
    if (cardioMinutes > 0 && cardio.length) {
      const chosen = cardio[dayIndex % cardio.length].exercise;
      selected.push({
        ...createPrescription(chosen, input),
        targetDurationSeconds: cardioMinutes * 60,
      });
    }
    return {
      name,
      estimatedMinutes: input.sessionMinutes,
      exercises: selected,
    };
  });
}

export function generatePlanWithQuality(
  input: PlanInput,
  catalog: ExerciseCandidate[],
): GeneratedPlan {
  const eligible = catalog
    .filter((exercise) => isExerciseEligible(exercise, input))
    .map((exercise) => ({ exercise, score: scoreExercise(exercise, input) }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.exercise.id.localeCompare(right.exercise.id),
    );
  const standardThreeDayPlan =
    input.sessionsPerWeek === 3 && input.sessionMinutes === 60;
  const days = standardThreeDayPlan
    ? generateDiverseThreeDayPlan(input, eligible)
    : generateLegacySplit(input, eligible);
  const quality = evaluatePlanQuality(days, catalog, input);
  const diagnostics = qualityDiagnostics(quality, standardThreeDayPlan);
  if (diagnostics.length) throw new PlanConstraintError(diagnostics);
  return {
    days,
    quality,
    generatorVersion: input.generatorVersion ?? GENERATOR_VERSION,
  };
}

export function generatePlan(
  input: PlanInput,
  catalog: ExerciseCandidate[],
): GeneratedDay[] {
  return generatePlanWithQuality(input, catalog).days;
}
