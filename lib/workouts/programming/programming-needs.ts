import type {
  FatigueProfile,
  GoalStrategy,
  NeedCoverageStatus,
  NormalizedTrainingProfile,
  ProgrammingNeed,
  ProgrammingNeedCode,
  TrainingRole,
  TrainingSlot,
} from "../types";

export type CoverageAnalysis = {
  status: NeedCoverageStatus;
  exposure: number;
  target: number;
  redundancy: number;
};

const optionalThreshold = 45;

export function determineProgrammingNeed(
  role: TrainingRole,
  patterns: string[],
  profile: NormalizedTrainingProfile,
  strategy: GoalStrategy,
  optionalOrdinal = 1,
): ProgrammingNeed {
  const primaryPattern = patterns[0] ?? strategy.patternPriorities[0] ?? "squat";
  const code = needCode(role, primaryPattern, strategy.goal);
  const targetWeeklyExposure = targetExposure(code, profile.sessionsPerWeek, optionalOrdinal);
  return {
    code,
    role,
    patterns,
    targetMuscles: musclesForPatterns(patterns),
    targetWeeklyExposure,
    goalRelevant: needSupportsGoal(code, strategy.goal),
    corrective: role === "CORRECTIVE",
    rationale: needRationale(code, strategy.label),
  };
}

export function analyzeCoverage(
  need: ProgrammingNeed,
  acceptedSlots: TrainingSlot[],
): CoverageAnalysis {
  const exposure = acceptedSlots.reduce(
    (sum, slot) => sum + coverageContribution(need, slot),
    0,
  );
  const ratio = need.targetWeeklyExposure > 0 ? exposure / need.targetWeeklyExposure : 1;
  return {
    status: ratio >= 1 ? "COVERED" : ratio >= 0.5 ? "PARTIALLY_COVERED" : "UNMET",
    exposure: Number(exposure.toFixed(2)),
    target: need.targetWeeklyExposure,
    redundancy: Number(Math.max(0, ratio - 1).toFixed(2)),
  };
}

export function evaluateSlotJustification(
  need: ProgrammingNeed,
  coverage: CoverageAnalysis,
  requirement: "REQUIRED" | "OPTIONAL",
  fatigueBudget: FatigueProfile,
  estimatedTimeMinutes: number,
) {
  if (requirement === "REQUIRED")
    return {
      keep: true,
      value: 100,
      threshold: 0,
      justification: `Necessidade estrutural: ${need.rationale}`,
    };

  let value = 24;
  value += coverage.status === "UNMET" ? 34 : coverage.status === "PARTIALLY_COVERED" ? 18 : -30;
  if (need.goalRelevant) value += 18;
  if (need.corrective && coverage.status === "COVERED") value -= 45;
  value -= fatigueBudget === "high" ? 12 : fatigueBudget === "medium" ? 7 : 3;
  value -= Math.max(0, estimatedTimeMinutes - 6);
  value -= Math.round(coverage.redundancy * 18);
  value = Math.max(0, Math.min(100, value));
  const keep = value >= optionalThreshold;
  const justification = keep
    ? `${need.rationale} Cobertura ${coverage.status.toLowerCase()} (${coverage.exposure}/${coverage.target}); o ganho de programação justifica o custo do slot.`
    : `${need.rationale} Cobertura ${coverage.status.toLowerCase()} (${coverage.exposure}/${coverage.target}); o slot não acrescenta valor suficiente.`;
  return { keep, value, threshold: optionalThreshold, justification };
}

export function estimateSlotTime(role: TrainingRole) {
  if (role === "CONDITIONING") return 10;
  if (role.startsWith("PRIMARY")) return 8;
  if (role.startsWith("SECONDARY")) return 7;
  if (role === "CORRECTIVE" || role === "MOBILITY") return 5;
  return 6;
}

function needCode(
  role: TrainingRole,
  pattern: string,
  goal: GoalStrategy["goal"],
): ProgrammingNeedCode {
  if (role === "CONDITIONING" || pattern === "cardio") return "CONDITIONING";
  if (role === "MOBILITY" || pattern === "mobility") return "MOBILITY";
  if (role === "CORRECTIVE")
    return pattern.startsWith("core") ? "TRUNK_STABILITY" : "SCAPULAR_CONTROL";
  if (role === "CORE" || pattern.startsWith("core") || pattern === "carry") return "TRUNK_STABILITY";
  if (role === "ACCESSORY" || role === "ISOLATION")
    return goal === "posture" ? "SCAPULAR_CONTROL" : "SUPPORTING_VOLUME";
  if (pattern === "horizontal_push") return "HORIZONTAL_PUSH";
  if (pattern === "vertical_push") return "VERTICAL_PUSH";
  if (pattern === "horizontal_pull") return "HORIZONTAL_PULL";
  if (pattern === "vertical_pull" || pattern === "posture") return "VERTICAL_PULL";
  if (["hinge", "hip_extension", "knee_flexion"].includes(pattern)) return "POSTERIOR_CHAIN";
  if (["squat", "knee_extension"].includes(pattern))
    return role === "PRIMARY_LOWER" ? "PRIMARY_LOWER_STIMULUS" : "KNEE_DOMINANT";
  return "SUPPORTING_VOLUME";
}

function targetExposure(code: ProgrammingNeedCode, frequency: number, optionalOrdinal: number) {
  if (["SUPPORTING_VOLUME", "CONDITIONING", "MOBILITY"].includes(code))
    return frequency * optionalOrdinal;
  if (code === "SCAPULAR_CONTROL" || code === "TRUNK_STABILITY") return Math.max(1, Math.ceil(frequency / 2));
  return Math.max(1, frequency);
}

function needSupportsGoal(code: ProgrammingNeedCode, goal: GoalStrategy["goal"]) {
  if (goal === "posture")
    return ["HORIZONTAL_PULL", "VERTICAL_PULL", "POSTERIOR_CHAIN", "SCAPULAR_CONTROL", "TRUNK_STABILITY"].includes(code);
  if (goal === "mobility") return ["MOBILITY", "TRUNK_STABILITY", "SCAPULAR_CONTROL"].includes(code);
  if (["conditioning", "cardio_endurance", "fat_loss", "weight_loss", "measurements"].includes(goal))
    return code === "CONDITIONING";
  if (goal === "muscle_gain" || goal === "strength")
    return !["CONDITIONING", "MOBILITY", "SCAPULAR_CONTROL"].includes(code);
  return true;
}

function coverageContribution(need: ProgrammingNeed, slot: TrainingSlot) {
  if (slot.need === need.code) return 1;
  if (need.code === "SCAPULAR_CONTROL" && slot.patterns.some((pattern) =>
    ["horizontal_pull", "vertical_pull", "posture"].includes(pattern))) return 0.5;
  if (need.code === "TRUNK_STABILITY" && slot.patterns.some((pattern) =>
    ["carry", "hinge", "core_anti_rotation", "core_anti_extension"].includes(pattern))) return 0.5;
  if (need.code === "POSTERIOR_CHAIN" && slot.patterns.some((pattern) =>
    ["hinge", "hip_extension", "knee_flexion"].includes(pattern))) return 0.5;
  return 0;
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

function needRationale(code: ProgrammingNeedCode, goalLabel: string) {
  const labels: Record<ProgrammingNeedCode, string> = {
    PRIMARY_LOWER_STIMULUS: "A semana precisa de um estímulo principal de membros inferiores.",
    HORIZONTAL_PUSH: "A arquitetura precisa de exposição de empurrar horizontal.",
    VERTICAL_PUSH: "A arquitetura precisa de exposição de empurrar vertical.",
    HORIZONTAL_PULL: "A arquitetura precisa de exposição de puxar horizontal.",
    VERTICAL_PULL: "A arquitetura precisa de exposição de puxar vertical.",
    POSTERIOR_CHAIN: "A distribuição semanal precisa de trabalho de cadeia posterior.",
    KNEE_DOMINANT: "A distribuição semanal precisa de trabalho dominante de joelho.",
    SUPPORTING_VOLUME: "Volume complementar acrescenta estímulo útil sem repetir a função principal.",
    TRUNK_STABILITY: "O programa ainda precisa de uma função complementar de estabilidade de tronco.",
    SCAPULAR_CONTROL: "O programa ainda precisa de uma função complementar de controle escapular.",
    CONDITIONING: "A estratégia requer contribuição explícita de condicionamento.",
    MOBILITY: "A estratégia requer exposição explícita de mobilidade.",
  };
  return `${labels[code]} Relação com o objetivo: ${goalLabel.toLowerCase()}.`;
}
