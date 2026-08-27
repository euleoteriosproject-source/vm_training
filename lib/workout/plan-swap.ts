import { z } from "zod";

export const planSwapRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("replace"),
    replacementExerciseId: z.string().uuid(),
    replacementType: z.enum(["DIRECT_EQUIVALENT", "GOAL_ALIGNED_ALTERNATIVE"]),
    reasonCode: z
      .enum(["exercise_dislike", "user_choice", "other"])
      .default("user_choice"),
    persistExclusion: z.boolean().default(false),
  }),
  z.object({
    action: z.literal("preview-rebalance"),
    desiredExerciseId: z.string().uuid(),
    reasonCode: z
      .enum(["exercise_dislike", "user_choice", "other"])
      .default("user_choice"),
  }),
]);

export type ReplacementType =
  "DIRECT_EQUIVALENT" | "GOAL_ALIGNED_ALTERNATIVE" | "REQUIRES_REBALANCE";

export type PlanReplacementCandidate = {
  exerciseId: string;
  exerciseName: string;
  movementPattern: string;
  trainingRole: string;
  category: string;
  difficulty: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipmentNames: string[];
  mediaUrl: string | null;
  posterUrl: string | null;
  mediaType: "gif" | "video";
  replacementType: ReplacementType;
  goalAlignmentReason: string;
  reason: string;
  totalCount: number;
};

export function planSwapErrorMessage(message: string) {
  const normalized = message.toLocaleLowerCase("pt-BR");
  if (normalized.includes("função diferente"))
    return "Esse exercício tem uma função diferente no treino.";
  if (normalized.includes("posição segura"))
    return "Não encontramos uma posição segura para incluí-lo sem perder o equilíbrio do plano.";
  if (normalized.includes("alternativa segura"))
    return "Não encontramos uma alternativa segura para preservar a função removida.";
  if (normalized.includes("plano ativo mudou"))
    return "Seu plano mudou. Atualize a página e tente novamente.";
  if (normalized.includes("não há outras ocorrências"))
    return "Não há outras ocorrências desse exercício no plano atual.";
  if (normalized.includes("alteração persistente não encontrada"))
    return "A troca não está mais disponível para reorganização.";
  if (
    normalized.includes("indisponível") ||
    normalized.includes("inelegível") ||
    normalized.includes("equipamento")
  )
    return "Essa opção não está disponível com suas preferências e equipamentos atuais.";
  if (normalized.includes("qualidade") || normalized.includes("gates"))
    return "A alteração não preservaria a qualidade do plano e não foi aplicada.";
  return "Não foi possível alterar o treino agora. Nenhuma mudança foi aplicada.";
}
