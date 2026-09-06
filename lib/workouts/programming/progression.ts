import type { PerformanceRecord, ProgressionRecommendation } from "../types";

export function recommendProgression(
  exerciseId: string,
  history: PerformanceRecord[] = [],
): ProgressionRecommendation {
  const records = history
    .filter((record) => record.exerciseId === exerciseId)
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
    .slice(0, 3);
  if (records.length < 2)
    return {
      state: "INSUFFICIENT_DATA",
      reason: "Ainda não há duas sessões concluídas comparáveis.",
      loadChangePercent: 0,
    };
  const completion = records.map((record) =>
    record.prescribedSets ? record.completedSets / record.prescribedSets : 0,
  );
  const repTargetsMet = records.map((record) =>
    record.actualReps.length > 0 &&
    record.actualReps.every((reps) => reps >= record.prescribedRepMax),
  );
  const struggling = records.some((record, index) =>
    completion[index] < 0.75 ||
    (record.actualReps.length > 0 && record.actualReps.some((reps) => reps < record.prescribedRepMin)),
  );
  if (repTargetsMet.every(Boolean) && completion.every((value) => value >= 1))
    return {
      state: "PROGRESS",
      reason: "A faixa superior foi cumprida nas sessões recentes.",
      loadChangePercent: 2.5,
    };
  if (struggling)
    return {
      state: "REGRESS",
      reason: "A execução recente ficou abaixo do mínimo prescrito.",
      loadChangePercent: -5,
    };
  return {
    state: "MAINTAIN",
    reason: "Mantenha a carga até consolidar todas as séries e repetições.",
    loadChangePercent: 0,
  };
}
