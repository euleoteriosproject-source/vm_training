import type { GoalCode } from "./types";

export const GOAL_OPTIONS = [
  ["general_health", "Saúde e condicionamento", "Força, cardio e movimento em equilíbrio."],
  ["strength", "Força", "Movimentos estáveis, progressão e descansos maiores."],
  ["muscle_gain", "Força e massa muscular", "Compostos e acessórios com volume bem distribuído."],
  ["conditioning", "Condicionamento físico", "Força de base e maior presença de cardio."],
  ["mobility", "Mobilidade e qualidade de movimento", "Controle, mobilidade e força compatível."],
  ["posture", "Postura e performance geral", "Puxadas, estabilidade e movimento equilibrado."],
] as const satisfies readonly (readonly [GoalCode, string, string])[];

export function goalLabel(code: GoalCode | string) {
  return GOAL_OPTIONS.find(([candidate]) => candidate === code)?.[1] ?? code;
}
