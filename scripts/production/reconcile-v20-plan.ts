import { generatePlan } from "../../lib/workouts/generator.ts";
import type {
  ExerciseCandidate,
  GoalCode,
  PlanInput,
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
  inProgressSessionIds: string[];
};

const PROJECT_REF = "inghftngeritrsezwxnm";
const args = parseArgs();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || new URL(url).hostname.split(".")[0] !== PROJECT_REF)
  throw new Error("Projeto Supabase diverge do gate v2.0");
if (args.apply && !args.allowProduction)
  throw new Error("Production exige --apply --allow-production");

const client = getAdminClient()!;
const [
  { data: reconciliationData, error: reconciliationError },
  { data: exercises, error: exercisesError },
] = await Promise.all([
  client.rpc("get_v20_plan_reconciliation_input"),
  client
    .from("exercises")
    .select(
      "id,slug,name_pt,movement_pattern,category,difficulty,active,exercise_media(status,media_type,media_role,execution_quality,is_primary),exercise_equipment(required,equipment(slug))",
    ),
]);
if (reconciliationError) throw reconciliationError;
if (exercisesError) throw exercisesError;
const reconciliation = reconciliationData as ReconciliationInput;
if (!reconciliation?.userId || !reconciliation.preferences)
  throw new Error("Entrada de reconciliação v2.0 incompleta");

const preferenceMap = Object.fromEntries(
  reconciliation.exercisePreferences.map((row) => [
    row.exerciseId,
    row.preference,
  ]),
) as PlanInput["preferences"];
const catalog: (ExerciseCandidate & { slug: string })[] = (exercises ?? []).map(
  (row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name_pt,
    pattern: row.movement_pattern,
    category: row.category,
    difficulty: row.difficulty,
    active: row.active,
    hasApprovedMedia: (row.exercise_media ?? []).some(
      (media: {
        status: string;
        media_type: string;
        media_role: string | null;
        execution_quality: string;
        is_primary: boolean;
      }) =>
        media.status === "approved" &&
        media.execution_quality === "approved" &&
        media.media_role === "PRIMARY_DEMO" &&
        media.is_primary &&
        ["video", "gif"].includes(media.media_type),
    ),
    equipment: (row.exercise_equipment ?? [])
      .filter((entry) => entry.required)
      .flatMap((entry) => {
        const relation = entry.equipment as unknown as
          { slug: string } | { slug: string }[] | null;
        return Array.isArray(relation)
          ? relation.map((item) => item.slug)
          : relation
            ? [relation.slug]
            : [];
      }),
  }),
);
const input: PlanInput = {
  goals: reconciliation.goals,
  sessionsPerWeek: reconciliation.preferences.sessionsPerWeek,
  sessionMinutes: reconciliation.preferences.sessionMinutes,
  cardioPreference: reconciliation.preferences.cardioPreference,
  experience: reconciliation.preferences.experience,
  equipment: reconciliation.equipment,
  preferences: preferenceMap,
};
const days = generatePlan(input, catalog);
if (
  days.length !== input.sessionsPerWeek ||
  days.some((day) => day.exercises.length === 0)
)
  throw new Error("Gerador retornou plano estruturalmente incompleto");

const readyIds = new Set(
  catalog
    .filter((exercise) => exercise.active && exercise.hasApprovedMedia)
    .map((exercise) => exercise.id),
);
const plannedIds = new Set(
  days.flatMap((day) => day.exercises.map((item) => item.exerciseId)),
);
if ([...plannedIds].some((id) => !readyIds.has(id)))
  throw new Error("Gerador incluiu exercício sem PRIMARY_DEMO aprovada");
const slugsById = new Map(
  catalog.map((exercise) => [exercise.id, exercise.slug]),
);

log(
  "PREFLIGHT",
  `novo plano ${plannedIds.size}/${plannedIds.size} exercícios media-ready`,
);
for (const day of days)
  log(
    "PLAN",
    `${day.name}: ${day.exercises.map((item) => slugsById.get(item.exerciseId)).join(", ")}`,
  );
log(
  "PRESERVE",
  `${reconciliation.inProgressSessionIds.length} sessão(ões) em andamento`,
);
if (!args.apply) {
  log("DRY-RUN", "plano media-ready calculado; zero writes remotos");
} else {
  const payload = days.map((day) => ({
    name: day.name,
    estimatedMinutes: day.estimatedMinutes,
    exercises: day.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      sets: exercise.sets,
      repMin: exercise.repMin || null,
      repMax: exercise.repMax || null,
      restSeconds: exercise.restSeconds,
      targetDurationSeconds: exercise.targetDurationSeconds ?? null,
    })),
  }));
  const { data: appliedData, error: applyError } = await client.rpc(
    "reconcile_media_ready_plan_v20",
    { p_days: payload },
  );
  if (applyError) throw applyError;
  const applied = appliedData as {
    planId?: string;
    uniqueExercises?: number;
    inProgressSessions?: number;
  };
  if (
    !applied?.planId ||
    applied.uniqueExercises !== plannedIds.size ||
    applied.inProgressSessions !== reconciliation.inProgressSessionIds.length
  )
    throw new Error("Verificação pós-reconciliação divergiu");
  log(
    "APPLIED",
    `plano ativo com cobertura ${plannedIds.size}/${plannedIds.size}`,
  );
  log(
    "PRESERVED",
    `${applied.inProgressSessions} sessão(ões) em andamento preservada(s)`,
  );
}
