import {
  GENERATOR_VERSION,
  generatePlanWithQuality,
} from "../../lib/workouts/generator.ts";
import { isDeepStrictEqual } from "node:util";
import type {
  ExerciseCandidate,
  GoalCode,
  PlanInput,
  PlanQualityMetrics,
} from "../../lib/workouts/types.ts";
import { getAdminClient, log, parseArgs } from "../media/shared.ts";

type ReconciliationInput = {
  userId: string;
  preferences: {
    sessionsPerWeek: PlanInput["sessionsPerWeek"];
    sessionMinutes: PlanInput["sessionMinutes"];
    cardioPreference: PlanInput["cardioPreference"];
    experience: PlanInput["experience"];
  };
  goals: { code: GoalCode; priority: number }[];
  equipment: string[];
  exercisePreferences: { exerciseId: string; preference: string }[];
  movementAttentionPatterns: string[];
  recentExerciseIds: string[];
  catalog: Array<{
    id: string;
    name: string;
    pattern: string;
    category: ExerciseCandidate["category"];
    difficulty: ExerciseCandidate["difficulty"];
    active: boolean;
    mediaReady: boolean;
    autoPlanEligible: boolean;
    eligibilityReasons: string[];
    equipment: string[];
  }>;
};

type LegacyReconciliationInput = {
  userId: string;
  inProgressSessionIds: string[];
};

function comparableQuality(quality: PlanQualityMetrics) {
  const sortedRecord = (record: Record<string, number>) =>
    Object.fromEntries(
      Object.entries(record).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
  return {
    totalSlots: quality.totalSlots,
    uniqueExercises: quality.uniqueExercises,
    uniquenessPercent: quality.uniquenessPercent,
    maxExactExerciseFrequency: quality.maxExactExerciseFrequency,
    exactExerciseOnAllDays: [...quality.exactExerciseOnAllDays].sort(),
    dayPairOverlapPercent: sortedRecord(quality.dayPairOverlapPercent),
    movementPatternCount: quality.movementPatternCount,
    movementPatternDistribution: sortedRecord(
      quality.movementPatternDistribution,
    ),
    mediaCoveragePercent: quality.mediaCoveragePercent,
    invalidEquipment: [...quality.invalidEquipment].sort(),
    ineligibleExercises: [...quality.ineligibleExercises].sort(),
  };
}

const PROJECT_REF = "inghftngeritrsezwxnm";
const args = parseArgs();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || new URL(url).hostname.split(".")[0] !== PROJECT_REF)
  throw new Error("Projeto Supabase diverge do gate v2.1");
if (args.apply && !args.allowProduction)
  throw new Error("Production exige --apply --allow-production");

const client = getAdminClient()!;
const [v21Result, legacyResult] = await Promise.all([
  client.rpc("get_v21_plan_reconciliation_input"),
  client.rpc("get_v20_plan_reconciliation_input"),
]);
if (v21Result.error) throw v21Result.error;
if (legacyResult.error) throw legacyResult.error;
const reconciliation = v21Result.data as ReconciliationInput;
const legacy = legacyResult.data as LegacyReconciliationInput;
if (
  !reconciliation?.userId ||
  !reconciliation.preferences ||
  reconciliation.userId !== legacy.userId
)
  throw new Error("Entrada de reconciliação v2.1 incompleta ou divergente");

const preferences = Object.fromEntries(
  reconciliation.exercisePreferences.map((row) => [
    row.exerciseId,
    row.preference,
  ]),
) as PlanInput["preferences"];
const catalog: ExerciseCandidate[] = reconciliation.catalog.map((row) => ({
  id: row.id,
  name: row.name,
  pattern: row.pattern,
  category: row.category,
  difficulty: row.difficulty,
  active: row.active,
  hasApprovedMedia: row.mediaReady,
  mediaReady: row.mediaReady,
  autoPlanEligible: row.autoPlanEligible,
  eligibilityReasons: row.eligibilityReasons,
  equipment: row.equipment,
}));
const input: PlanInput = {
  goals: reconciliation.goals,
  sessionsPerWeek: reconciliation.preferences.sessionsPerWeek,
  sessionMinutes: reconciliation.preferences.sessionMinutes,
  cardioPreference: reconciliation.preferences.cardioPreference,
  experience: reconciliation.preferences.experience,
  equipment: reconciliation.equipment,
  preferences,
  movementAttentionPatterns: reconciliation.movementAttentionPatterns,
  recentExerciseIds: reconciliation.recentExerciseIds,
  generatorVersion: GENERATOR_VERSION,
};
const generated = generatePlanWithQuality(input, catalog);
const slugsById = new Map(
  reconciliation.catalog.map((exercise) => [exercise.id, exercise.name]),
);
const eligibleCount = catalog.filter(
  (exercise) => exercise.autoPlanEligible,
).length;

log(
  "PREFLIGHT",
  `${eligibleCount} exercícios elegíveis; ${generated.quality.uniqueExercises}/${generated.quality.totalSlots} únicos no plano`,
);
for (const day of generated.days)
  log(
    "PLAN",
    `${day.name}: ${day.exercises.map((item) => slugsById.get(item.exerciseId)).join(", ")}`,
  );
log("QUALITY", JSON.stringify(generated.quality));
log(
  "PRESERVE",
  `${legacy.inProgressSessionIds.length} sessão(ões) em andamento`,
);

if (!args.apply) {
  log("DRY-RUN", "plano v2.1 calculado; zero writes remotos");
} else {
  const beforeSessions = [...legacy.inProgressSessionIds].sort();
  const { data, error } = await client.rpc("reconcile_plan_v21", {
    p_days: generated.days,
    p_generator_version: generated.generatorVersion,
    p_rationale: {
      strategy: "deterministic-diversity-v21",
      quality: generated.quality,
      recentExerciseWindow: reconciliation.recentExerciseIds.length,
    },
  });
  if (error) throw error;
  const applied = data as {
    planId?: string;
    quality?: PlanQualityMetrics;
  };
  if (!applied.planId || !applied.quality)
    throw new Error("Resposta de ativação v2.1 incompleta");
  if (
    !isDeepStrictEqual(
      comparableQuality(applied.quality),
      comparableQuality(generated.quality),
    )
  )
    throw new Error("Métricas pós-ativação divergem do preflight");

  const { data: afterData, error: afterError } = await client.rpc(
    "get_v20_plan_reconciliation_input",
  );
  if (afterError) throw afterError;
  const after = afterData as LegacyReconciliationInput;
  const afterSessions = [...after.inProgressSessionIds].sort();
  if (JSON.stringify(beforeSessions) !== JSON.stringify(afterSessions))
    throw new Error("Sessões em andamento divergiram após reconciliação");
  log(
    "APPLIED",
    `plano v2.1 ativo com ${applied.quality.uniqueExercises}/${applied.quality.totalSlots} exercícios únicos`,
  );
  log(
    "PRESERVED",
    `${afterSessions.length} sessão(ões) em andamento preservada(s)`,
  );
}
