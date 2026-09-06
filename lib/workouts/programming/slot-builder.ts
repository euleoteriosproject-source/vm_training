import type {
  GoalStrategy,
  NormalizedTrainingProfile,
  TrainingArchitecture,
  TrainingRole,
  TrainingSlot,
} from "../types";

const slotsByMinutes: Record<number, number> = { 30: 4, 45: 5, 60: 6, 75: 7, 90: 8 };

export function buildTrainingSlots(
  profile: NormalizedTrainingProfile,
  strategy: GoalStrategy,
  architecture: TrainingArchitecture,
): TrainingSlot[] {
  const perDay = slotsByMinutes[profile.sessionMinutes];
  let conditioningRemaining = strategy.conditioningSlotsPerWeek;
  let mobilityRemaining = strategy.mobilitySlotsPerWeek;
  return architecture.days.flatMap((day, dayIndex) => {
    const patterns = [...day.patternBias];
    const roles = rolesForDay(day.name, perDay);
    if (day.name.toLowerCase().includes("corpo inteiro") && roles.length > 4)
      roles[4] = dayIndex % 2 === 0 ? "SECONDARY_PULL" : "SECONDARY_PUSH";
    if (["muscle_gain", "strength"].includes(strategy.goal))
      for (let index = 0; index < roles.length; index++)
        if (roles[index] === "CORE" || roles[index] === "MOBILITY") roles[index] = "ACCESSORY";
    if (conditioningRemaining > 0) {
      roles[roles.length - 1] = "CONDITIONING";
      conditioningRemaining -= 1;
    } else if (mobilityRemaining > 0) {
      roles[roles.length - 1] = profile.primaryGoal === "posture" ? "CORRECTIVE" : "MOBILITY";
      mobilityRemaining -= 1;
    }
    return roles.map((role, position) => {
      const slotPatterns = patternsForRole(role, patterns, position, strategy.patternPriorities);
      return {
        id: `${architecture.id}-d${dayIndex + 1}-s${position + 1}`,
        dayIndex,
        position,
        role,
        patterns: slotPatterns,
        targetMuscles: musclesForPatterns(slotPatterns),
        priority: position < 2 ? "high" : position < 4 ? "medium" : "low",
        fatigueBudget: position === 0 ? "high" : position < 4 ? "medium" : "low",
        maxTechnicalComplexity: profile.experience === "beginner" ? (position < 2 ? "moderate" : "low") : "high",
        rationale: rationaleForRole(role, strategy.label, day.name),
      } satisfies TrainingSlot;
    });
  });
}

function rolesForDay(name: string, count: number): TrainingRole[] {
  const lower = name.toLowerCase();
  const base: TrainingRole[] = lower.includes("inferior")
    ? ["PRIMARY_LOWER", "SECONDARY_LOWER", "PRIMARY_PULL", "ACCESSORY", "ISOLATION", "CORE", "ACCESSORY", "MOBILITY"]
    : lower.includes("empurrar")
      ? ["PRIMARY_PUSH", "SECONDARY_PUSH", "PRIMARY_PULL", "ACCESSORY", "ISOLATION", "CORE", "ACCESSORY", "MOBILITY"]
      : lower.includes("puxar")
        ? ["PRIMARY_PULL", "SECONDARY_PULL", "PRIMARY_PUSH", "ACCESSORY", "ISOLATION", "CORE", "ACCESSORY", "MOBILITY"]
        : lower.includes("superior")
          ? ["PRIMARY_PULL", "PRIMARY_PUSH", "SECONDARY_PULL", "SECONDARY_PUSH", "ACCESSORY", "CORE", "ISOLATION", "MOBILITY"]
          : ["PRIMARY_LOWER", "PRIMARY_PULL", "PRIMARY_PUSH", "SECONDARY_LOWER", "SECONDARY_PUSH", "CORE", "ACCESSORY", "MOBILITY"];
  return base.slice(0, count);
}

function patternsForRole(role: TrainingRole, bias: string[], position: number, priorities: string[]) {
  const rolePatterns: Partial<Record<TrainingRole, string[]>> = {
    PRIMARY_LOWER: ["squat", "hinge", "hip_extension", "knee_extension"],
    SECONDARY_LOWER: ["knee_flexion", "knee_extension", "hip_extension", "hinge", "squat"],
    PRIMARY_PUSH: ["horizontal_push", "vertical_push"],
    SECONDARY_PUSH: ["vertical_push", "horizontal_push"],
    PRIMARY_PULL: ["horizontal_pull", "vertical_pull"],
    SECONDARY_PULL: ["vertical_pull", "horizontal_pull", "posture"],
    CORE: ["core_anti_rotation", "core_anti_extension", "carry"],
    CONDITIONING: ["cardio", "carry"],
    MOBILITY: ["mobility", "posture"],
    CORRECTIVE: ["posture", "mobility", "core_anti_rotation"],
    ACCESSORY: ["knee_flexion", "knee_extension", "hip_extension", "vertical_push", "vertical_pull", "carry", "posture"],
    ISOLATION: ["knee_flexion", "knee_extension", "hip_extension", "posture", "vertical_push"],
  };
  const allowed = rolePatterns[role] ?? priorities;
  const ordered = [...bias, ...priorities, ...allowed].filter((pattern, index, all) => allowed.includes(pattern) && all.indexOf(pattern) === index);
  return ordered.length ? ordered : [priorities[position % priorities.length] ?? "squat"];
}

function musclesForPatterns(patterns: string[]) {
  const map: Record<string, string[]> = {
    squat: ["quadriceps", "glutes"], hinge: ["hamstrings", "glutes"], hip_extension: ["glutes"],
    knee_extension: ["quadriceps"], knee_flexion: ["hamstrings"], horizontal_push: ["chest", "triceps"],
    vertical_push: ["shoulders", "triceps"], horizontal_pull: ["back", "biceps"], vertical_pull: ["lats", "biceps"],
    posture: ["upper_back"], core_anti_rotation: ["core"], core_anti_extension: ["core"], carry: ["core", "grip"],
  };
  return [...new Set(patterns.flatMap((pattern) => map[pattern] ?? []))];
}

function rationaleForRole(role: TrainingRole, goal: string, day: string) {
  return `${role.replaceAll("_", " ").toLowerCase()} para sustentar ${goal.toLowerCase()} no dia ${day}.`;
}
