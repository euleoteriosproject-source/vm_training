import type {
  GoalStrategy,
  NormalizedTrainingProfile,
  TrainingArchitecture,
  TrainingRole,
  TrainingSlot,
} from "../types";
import {
  analyzeCoverage,
  determineProgrammingNeed,
  estimateSlotTime,
  evaluateSlotJustification,
} from "./programming-needs.ts";

const slotsByMinutes: Record<number, number> = { 30: 4, 45: 5, 60: 6, 75: 7, 90: 8 };

export function buildTrainingSlots(
  profile: NormalizedTrainingProfile,
  strategy: GoalStrategy,
  architecture: TrainingArchitecture,
): TrainingSlot[] {
  return buildTrainingSlotDecision(profile, strategy, architecture).slots;
}

export function buildTrainingSlotDecision(
  profile: NormalizedTrainingProfile,
  strategy: GoalStrategy,
  architecture: TrainingArchitecture,
): { slots: TrainingSlot[]; prunedSlots: TrainingSlot[] } {
  const perDay = slotsByMinutes[profile.sessionMinutes];
  let conditioningRemaining = strategy.conditioningSlotsPerWeek;
  let mobilityRemaining = strategy.mobilitySlotsPerWeek;
  const candidates = architecture.days.flatMap((day, dayIndex) => {
    const patterns = [...day.patternBias];
    const roles = rolesForDay(day.name, perDay);
    const usedPrimaryPatterns = new Set<string>();
    if (day.name.toLowerCase().includes("corpo inteiro") && roles.length > 4)
      roles[4] = dayIndex % 2 === 0 ? "SECONDARY_PULL" : "SECONDARY_PUSH";
    if (["muscle_gain", "strength"].includes(strategy.goal))
      for (let index = 0; index < roles.length; index++)
        if (roles[index] === "CORE" || roles[index] === "MOBILITY") roles[index] = "ACCESSORY";
    if (profile.primaryGoal === "posture") {
      if (roles.length > 5) roles[roles.length - 1] = "CORRECTIVE";
    } else if (conditioningRemaining > 0) {
      roles[roles.length - 1] = "CONDITIONING";
      conditioningRemaining -= 1;
    } else if (mobilityRemaining > 0) {
      roles[roles.length - 1] = "MOBILITY";
      mobilityRemaining -= 1;
    }
    return roles.map((role, position) => {
      const slotPatterns = patternsForRole(
        role,
        patterns,
        position,
        strategy.patternPriorities,
        usedPrimaryPatterns,
        profile.primaryGoal,
      );
      usedPrimaryPatterns.add(slotPatterns[0]);
      const fatigueBudget = position === 0 ? "high" : position < 4 ? "medium" : "low";
      const requirement = position < Math.min(5, perDay) ? "REQUIRED" : "OPTIONAL";
      const need = determineProgrammingNeed(
        role,
        slotPatterns,
        profile,
        strategy,
        Math.max(1, position - 4),
      );
      return {
        id: `${architecture.id}-d${dayIndex + 1}-s${position + 1}`,
        dayIndex,
        position,
        role,
        patterns: slotPatterns,
        targetMuscles: need.targetMuscles,
        priority: position < 2 ? "high" : position < 4 ? "medium" : "low",
        fatigueBudget,
        maxTechnicalComplexity: profile.experience === "beginner" ? (position < 2 ? "moderate" : "low") : "high",
        rationale: rationaleForRole(role, strategy.label, day.name),
        need: need.code,
        needStatus: "UNMET",
        requirement,
        programmingValue: 0,
        minimumProgrammingValue: requirement === "REQUIRED" ? 0 : 45,
        estimatedTimeMinutes: estimateSlotTime(role),
        redundancy: 0,
        justification: need.rationale,
      } satisfies TrainingSlot;
    });
  });

  const accepted: TrainingSlot[] = [];
  const prunedSlots: TrainingSlot[] = [];
  const ordered = [...candidates].sort(
    (left, right) =>
      (left.requirement === right.requirement ? 0 : left.requirement === "REQUIRED" ? -1 : 1) ||
      left.position - right.position ||
      left.dayIndex - right.dayIndex,
  );
  for (const slot of ordered) {
    const need = determineProgrammingNeed(
      slot.role,
      slot.patterns,
      profile,
      strategy,
      Math.max(1, slot.position - 4),
    );
    const coverage = analyzeCoverage(need, accepted);
    const decision = evaluateSlotJustification(
      need,
      coverage,
      slot.requirement,
      slot.fatigueBudget,
      slot.estimatedTimeMinutes,
    );
    const evaluated = {
      ...slot,
      needStatus: coverage.status,
      programmingValue: decision.value,
      minimumProgrammingValue: decision.threshold,
      redundancy: coverage.redundancy,
      justification: decision.justification,
    };
    if (decision.keep) accepted.push(evaluated);
    else prunedSlots.push(evaluated);
  }
  return {
    slots: accepted.sort((left, right) => left.dayIndex - right.dayIndex || left.position - right.position),
    prunedSlots: prunedSlots.sort((left, right) => left.dayIndex - right.dayIndex || left.position - right.position),
  };
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

function patternsForRole(
  role: TrainingRole,
  bias: string[],
  position: number,
  priorities: string[],
  usedPrimaryPatterns: Set<string>,
  primaryGoal: NormalizedTrainingProfile["primaryGoal"],
) {
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
  // Generic stretching is not a substitute for supported strength/postural
  // work in a posture-focused plan. Mobility remains available for the
  // dedicated mobility goal.
  const allowed = role === "CORRECTIVE" && primaryGoal === "posture"
    ? ["posture", "core_anti_rotation"]
    : rolePatterns[role] ?? priorities;
  const ordered = [...bias, ...priorities, ...allowed].filter((pattern, index, all) => allowed.includes(pattern) && all.indexOf(pattern) === index);
  const rotated = [
    ...ordered.filter((pattern) => !usedPrimaryPatterns.has(pattern)),
    ...ordered.filter((pattern) => usedPrimaryPatterns.has(pattern)),
  ];
  return rotated.length ? rotated : [priorities[position % priorities.length] ?? "squat"];
}

function rationaleForRole(role: TrainingRole, goal: string, day: string) {
  return `${role.replaceAll("_", " ").toLowerCase()} para sustentar ${goal.toLowerCase()} no dia ${day}.`;
}
