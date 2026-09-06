import type { GoalCode, GoalStrategy, NormalizedTrainingProfile } from "../types";

const conditioningGoals = new Set<GoalCode>([
  "conditioning",
  "cardio_endurance",
  "fat_loss",
  "weight_loss",
  "measurements",
]);

export function resolveGoalStrategy(profile: NormalizedTrainingProfile): GoalStrategy {
  const goal = profile.primaryGoal;
  if (goal === "strength")
    return strategy(goal, "Força", 0.9, 0, 0, [3, 6], 4, 3, 2, 150, 105, 75,
      ["squat", "hinge", "horizontal_push", "horizontal_pull", "vertical_push", "vertical_pull"]);
  if (goal === "muscle_gain")
    return strategy(goal, "Hipertrofia", 0.9, 0, 0, [8, 12], 4, 3, 3, 105, 90, 60,
      ["squat", "horizontal_push", "horizontal_pull", "knee_flexion", "vertical_push", "vertical_pull"]);
  if (conditioningGoals.has(goal))
    return strategy(goal, "Condicionamento", 0.65, profile.sessionsPerWeek, 0, [8, 15], 3, 3, 2, 75, 60, 45,
      ["squat", "horizontal_pull", "horizontal_push", "hinge", "cardio", "carry"]);
  if (goal === "mobility" || goal === "posture")
    return strategy(goal, goal === "posture" ? "Postura" : "Mobilidade", 0.65, 0, profile.sessionsPerWeek, [8, 15], 3, 3, 2, 75, 60, 45,
      ["horizontal_pull", "posture", "mobility", "hinge", "core_anti_rotation", "squat"]);
  return strategy(goal, "Saúde geral", 0.75, profile.sessionsPerWeek >= 3 ? 1 : 0, profile.sessionsPerWeek >= 3 ? 1 : 0,
    [6, 12], 3, 3, 2, 90, 75, 60,
    ["squat", "horizontal_pull", "horizontal_push", "hinge", "vertical_pull", "vertical_push"]);
}

function strategy(
  goal: GoalCode,
  label: string,
  strengthShare: number,
  conditioningSlotsPerWeek: number,
  mobilitySlotsPerWeek: number,
  preferredRepRange: [number, number],
  primarySets: number,
  secondarySets: number,
  accessorySets: number,
  primaryRest: number,
  secondaryRest: number,
  accessoryRest: number,
  patternPriorities: string[],
): GoalStrategy {
  return {
    goal,
    label,
    strengthShare,
    conditioningSlotsPerWeek,
    mobilitySlotsPerWeek,
    preferredRepRange,
    primarySets,
    secondarySets,
    accessorySets,
    restSeconds: { primary: primaryRest, secondary: secondaryRest, accessory: accessoryRest },
    patternPriorities,
  };
}
