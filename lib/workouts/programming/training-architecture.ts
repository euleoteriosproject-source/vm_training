import type { GoalStrategy, NormalizedTrainingProfile, TrainingArchitecture } from "../types";

const fullBodyBiases = [
  ["squat", "horizontal_pull", "horizontal_push"],
  ["hinge", "vertical_pull", "vertical_push"],
  ["knee_extension", "horizontal_pull", "horizontal_push"],
  ["hip_extension", "vertical_pull", "vertical_push"],
  ["squat", "horizontal_pull", "vertical_push"],
];

export function buildTrainingArchitecture(
  profile: NormalizedTrainingProfile,
  strategy: GoalStrategy,
): TrainingArchitecture {
  const frequency = profile.sessionsPerWeek;
  let names: string[];
  let id: string;
  if (frequency <= 3) {
    names = fullBodyBiases.slice(0, frequency).map((_, index) => `Corpo inteiro ${String.fromCharCode(65 + index)}`);
    id = `full-body-${frequency}`;
  } else if (frequency === 4) {
    names = strategy.goal === "strength"
      ? ["Superior — força", "Inferior — força", "Superior — volume", "Inferior — volume"]
      : ["Superior A", "Inferior A", "Superior B", "Inferior B"];
    id = `upper-lower-${strategy.goal}`;
  } else {
    names = strategy.goal === "muscle_gain"
      ? ["Empurrar", "Puxar", "Inferior A", "Superior misto", "Inferior B"]
      : strategy.conditioningSlotsPerWeek > 0
        ? ["Corpo inteiro A", "Capacidade A", "Corpo inteiro B", "Capacidade B", "Corpo inteiro C"]
        : ["Superior A", "Inferior A", "Corpo inteiro", "Superior B", "Inferior B"];
    id = `five-day-${strategy.goal}`;
  }
  return {
    id,
    rationale: `${frequency} sessões estruturadas para ${strategy.label.toLowerCase()}, com distribuição semanal antes da escolha dos exercícios.`,
    days: names.map((name, index) => ({
      name,
      focus: dayFocus(name, strategy.label),
      patternBias: biasFor(name, index),
    })),
  };
}

function biasFor(name: string, index: number) {
  const normalized = name.toLowerCase();
  if (normalized.includes("superior") || normalized.includes("empurrar"))
    return normalized.includes("empurrar")
      ? ["horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull"]
      : ["horizontal_pull", "horizontal_push", "vertical_pull", "vertical_push"];
  if (normalized.includes("puxar")) return ["horizontal_pull", "vertical_pull", "horizontal_push", "vertical_push"];
  if (normalized.includes("inferior")) return ["squat", "hinge", "knee_flexion", "knee_extension", "hip_extension"];
  if (normalized.includes("capacidade")) return ["cardio", "carry", "squat", "horizontal_pull"];
  return fullBodyBiases[index % fullBodyBiases.length];
}

function dayFocus(name: string, goal: string) {
  return `${name}: prioridade em ${goal.toLowerCase()} com fadiga e ordem controladas.`;
}
