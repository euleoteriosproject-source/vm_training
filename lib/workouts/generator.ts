import type { ExerciseCandidate, GeneratedDay, PlanInput } from "./types";

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
  if (preference === "avoid") return -Infinity;
  if (input.experience === "beginner" && exercise.difficulty === "advanced")
    score -= 20;
  return score;
}

export function generatePlan(
  input: PlanInput,
  catalog: ExerciseCandidate[],
  options: { draft?: boolean } = {},
): GeneratedDay[] {
  const eligible = catalog
    .filter((exercise) =>
      options.draft
        ? true
        : exercise.active && exercise.hasApprovedMedia,
    )
    .filter((exercise) =>
      exercise.equipment.every(
        (item) => item === "bodyweight" || input.equipment.includes(item),
      ),
    )
    .map((exercise) => ({ exercise, score: scoreExercise(exercise, input) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort(
      (a, b) =>
        b.score - a.score || a.exercise.name.localeCompare(b.exercise.name),
    );

  if (eligible.length < 4)
    throw new Error(
      "Catálogo compatível insuficiente para gerar um plano seguro.",
    );

  const highCardio =
    input.cardioPreference >= 4 &&
    input.goals.some((goal) =>
      ["conditioning", "fat_loss", "weight_loss"].includes(goal.code),
    );
  const strengthCount = highCardio
    ? Math.max(2, Math.floor((input.sessionMinutes * 0.35) / 7))
    : Math.max(3, Math.floor((input.sessionMinutes * 0.72) / 7));
  const cardioMinutes = highCardio
    ? Math.round(input.sessionMinutes * 0.65)
    : input.cardioPreference >= 3
      ? Math.round(input.sessionMinutes * 0.22)
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
    const selected: GeneratedDay["exercises"] = [...resistance]
      .sort(
        (a, b) =>
          (used.get(a.exercise.id) ?? 0) - (used.get(b.exercise.id) ?? 0) ||
          b.score - a.score,
      )
      .slice(0, strengthCount)
      .map(({ exercise }) => {
        used.set(exercise.id, (used.get(exercise.id) ?? 0) + 1);
        const strengthGoal = input.goals.some(
          (goal) => goal.code === "strength" && goal.priority <= 2,
        );
        return {
          exerciseId: exercise.id,
          sets: strengthGoal ? 4 : 3,
          repMin: strengthGoal ? 5 : 8,
          repMax: strengthGoal ? 8 : 12,
          restSeconds: strengthGoal ? 120 : 75,
        };
      });
    const cardio =
      cardioMinutes > 0
        ? eligible.filter(({ exercise }) => exercise.category === "cardio")[
            dayIndex %
              Math.max(
                1,
                eligible.filter(
                  ({ exercise }) => exercise.category === "cardio",
                ).length,
              )
          ]
        : undefined;
    if (cardio)
      selected.push({
        exerciseId: cardio.exercise.id,
        sets: 1,
        repMin: 0,
        repMax: 0,
        restSeconds: 0,
        targetDurationSeconds: cardioMinutes * 60,
      });
    return {
      name,
      estimatedMinutes: input.sessionMinutes,
      exercises: selected,
    };
  });
}
