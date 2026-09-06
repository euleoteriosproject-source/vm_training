import type { NormalizedTrainingProfile, PlanInput } from "../types";

export function normalizeTrainingProfile(input: PlanInput): NormalizedTrainingProfile {
  const goals = [...input.goals].sort(
    (left, right) => left.priority - right.priority || left.code.localeCompare(right.code),
  );
  return {
    primaryGoal: goals[0]?.code ?? "general_health",
    secondaryGoals: goals.slice(1).map((goal) => goal.code),
    sessionsPerWeek: input.sessionsPerWeek,
    sessionMinutes: input.sessionMinutes,
    cardioPreference: input.cardioPreference,
    experience: input.experience,
    gymProfile: input.gymProfile ?? "STANDARD_COMMERCIAL_GYM",
    workoutStyle:
      input.workoutStyle ??
      (input.gymProfile === "STANDARD_COMMERCIAL_GYM" ? "gym_first" : "mixed"),
  };
}
