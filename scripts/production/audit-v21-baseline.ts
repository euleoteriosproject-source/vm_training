import { createHash } from "node:crypto";
import { getAdminClient } from "../media/shared.ts";

const PROJECT_REF = "inghftngeritrsezwxnm";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || new URL(url).hostname.split(".")[0] !== PROJECT_REF)
  throw new Error("Projeto Supabase diverge do gate v2.1");

const client = getAdminClient()!;
const validLicenses = new Set([
  "PD",
  "CC0-1.0",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "CC-BY-SA-3.0",
  "CC-BY-SA-4.0",
  "VITAL-FREE-PACK",
  "CUSTOM",
]);

type Relation<T> = T | T[] | null;

function one<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function storedObject(path: string | null) {
  if (!path) return { exists: false, hash: null };
  const { data, error } = await client.storage
    .from("exercise-media")
    .download(path);
  if (error || !data) return { exists: false, hash: null };
  const bytes = Buffer.from(await data.arrayBuffer());
  return {
    exists: true,
    hash: createHash("sha256").update(bytes).digest("hex"),
  };
}

function percentage(value: number, total: number) {
  return total ? Number(((value / total) * 100).toFixed(1)) : 0;
}

function overlap(left: Set<string>, right: Set<string>) {
  const denominator = Math.min(left.size, right.size);
  if (!denominator) return 0;
  const shared = [...left].filter((id) => right.has(id)).length;
  return percentage(shared, denominator);
}

const [
  { data: exercises, error: exerciseError },
  { data: plans, error: planError },
  { data: profiles, error: profileError },
  { data: reconciliation, error: reconciliationError },
  { data: v21Reconciliation, error: v21ReconciliationError },
  substitutionsResult,
  bucketResult,
  usersResult,
] = await Promise.all([
  client
    .from("exercises")
    .select(
      "id,slug,name_pt,active,category,movement_pattern,primary_muscles,secondary_muscles,difficulty,exercise_equipment(required,equipment(slug,name)),exercise_media(id,status,media_type,media_role,is_primary,execution_quality,license_code,license_url,source_name,source_url,original_file_url,author,attribution_required,attribution_text,content_hash,storage_path,poster_path,frame_count,animation_verified,review_state,review_method,validation_confidence)",
    )
    .order("slug"),
  client
    .from("workout_plans")
    .select(
      "id,user_id,name,status,sessions_per_week,target_session_minutes,created_at,activated_at,archived_at,generator_version,quality_metrics,generation_rationale,workout_days(id,name,position,estimated_minutes,workout_day_exercises(position,exercise_id,exercises(slug,movement_pattern)))",
    )
    .eq("status", "active"),
  client.from("profiles").select("user_id,role,onboarding_completed"),
  client.rpc("get_v20_plan_reconciliation_input"),
  client.rpc("get_v21_plan_reconciliation_input"),
  client
    .from("exercise_substitutions")
    .select(
      "exercise_id,alternative_exercise_id,score,same_movement_pattern,same_primary_muscle",
    ),
  client.storage.getBucket("exercise-media"),
  client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
]);

for (const error of [
  exerciseError,
  planError,
  profileError,
  reconciliationError,
  v21ReconciliationError,
  bucketResult.error,
  usersResult.error,
])
  if (error) throw error;

const catalog = [];
for (const exercise of exercises ?? []) {
  const primaryCandidates = (exercise.exercise_media ?? []).filter(
    (media) =>
      media.status === "approved" &&
      media.execution_quality === "approved" &&
      media.media_role === "PRIMARY_DEMO" &&
      media.is_primary,
  );
  const primary = primaryCandidates[0] ?? null;
  const motion = await storedObject(primary?.storage_path ?? null);
  const poster = await storedObject(primary?.poster_path ?? null);
  const licenseValid = Boolean(
    primary?.license_code && validLicenses.has(primary.license_code),
  );
  const provenanceValid = Boolean(
    primary?.source_name &&
    primary?.source_url &&
    primary?.author &&
    primary?.attribution_text,
  );
  const animationValid = Boolean(
    primary &&
    ["gif", "video"].includes(primary.media_type) &&
    primary.animation_verified &&
    (primary.frame_count ?? 0) > 1,
  );
  const hashValid = Boolean(
    primary?.content_hash && motion.hash === primary.content_hash,
  );
  const mediaReady = Boolean(
    primaryCandidates.length === 1 &&
    primary &&
    motion.exists &&
    poster.exists &&
    licenseValid &&
    provenanceValid &&
    animationValid &&
    hashValid,
  );
  catalog.push({
    id: exercise.id,
    slug: exercise.slug,
    name: exercise.name_pt,
    active: exercise.active,
    category: exercise.category,
    movementPattern: exercise.movement_pattern,
    primaryMuscles: exercise.primary_muscles ?? [],
    secondaryMuscles: exercise.secondary_muscles ?? [],
    difficulty: exercise.difficulty,
    equipment: (exercise.exercise_equipment ?? []).flatMap((entry) => {
      const equipment = one(entry.equipment);
      return equipment
        ? [{ slug: equipment.slug, required: entry.required }]
        : [];
    }),
    mediaRecords: exercise.exercise_media?.length ?? 0,
    primaryCount: primaryCandidates.length,
    mediaReady,
    primary: primary
      ? {
          type: primary.media_type,
          license: primary.license_code,
          source: primary.source_name,
          sourceUrl: primary.source_url,
          storagePath: primary.storage_path,
          posterPath: primary.poster_path,
          contentHash: primary.content_hash,
          motionExists: motion.exists,
          posterExists: poster.exists,
          hashValid,
          animationValid,
          licenseValid,
          provenanceValid,
          reviewState: primary.review_state,
          reviewMethod: primary.review_method,
          validationConfidence: primary.validation_confidence,
        }
      : null,
  });
}

const catalogById = new Map(catalog.map((exercise) => [exercise.id, exercise]));
const v21Input = v21Reconciliation as {
  catalog?: Array<{
    id: string;
    autoPlanEligible: boolean;
    eligibilityReasons: string[];
  }>;
};
const eligibilityById = new Map(
  (v21Input.catalog ?? []).map((exercise) => [exercise.id, exercise]),
);
for (const exercise of catalog) {
  const eligibility = eligibilityById.get(exercise.id);
  Object.assign(exercise, {
    autoPlanEligible: eligibility?.autoPlanEligible ?? false,
    eligibilityReasons: eligibility?.eligibilityReasons ?? ["not_evaluated"],
  });
}
const active = catalog.filter((exercise) => exercise.active);
const mediaReadyActive = active.filter((exercise) => exercise.mediaReady);
const autoPlanEligibleActive = active.filter(
  (exercise) =>
    (exercise as typeof exercise & { autoPlanEligible: boolean })
      .autoPlanEligible,
);
const allMedia = (exercises ?? []).flatMap(
  (exercise) => exercise.exercise_media ?? [],
);

function distribution(values: Array<string | null>): Record<string, number> {
  return Object.fromEntries(
    [...new Set(values.map((value) => value ?? "null"))]
      .map((value): [string, number] => [
        value,
        values.filter((candidate) => (candidate ?? "null") === value).length,
      ])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

const planReports = (plans ?? []).map((plan) => {
  const days = [...(plan.workout_days ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((day) => {
      const items = [...(day.workout_day_exercises ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((item) => {
          const exercise = catalogById.get(item.exercise_id);
          return {
            position: item.position,
            slug: exercise?.slug ?? "missing",
            movementPattern: exercise?.movementPattern ?? "missing",
            mediaReady: exercise?.mediaReady ?? false,
          };
        });
      return {
        name: day.name,
        position: day.position,
        exercises: items,
      };
    });
  const slots = days.flatMap((day) => day.exercises);
  const frequencies: Record<string, number> = Object.fromEntries(
    [...new Set(slots.map((item) => item.slug))]
      .map((slug): [string, number] => [
        slug,
        slots.filter((item) => item.slug === slug).length,
      ])
      .sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      ),
  );
  const pairwiseOverlap = [];
  for (let left = 0; left < days.length; left++)
    for (let right = left + 1; right < days.length; right++)
      pairwiseOverlap.push({
        pair: `${days[left].name} x ${days[right].name}`,
        percent: overlap(
          new Set(days[left].exercises.map((item) => item.slug)),
          new Set(days[right].exercises.map((item) => item.slug)),
        ),
      });
  const movementDistribution: Record<string, number> = Object.fromEntries(
    [...new Set(slots.map((item) => item.movementPattern))]
      .map((pattern): [string, number] => [
        pattern,
        slots.filter((item) => item.movementPattern === pattern).length,
      ])
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const unique = Object.keys(frequencies).length;
  return {
    ownerRole:
      profiles?.find((profile) => profile.user_id === plan.user_id)?.role ??
      "unknown",
    name: plan.name,
    generatorVersion: plan.generator_version,
    days,
    totalSlots: slots.length,
    uniqueExercises: unique,
    uniquenessPercent: percentage(unique, slots.length),
    maxExactExerciseFrequency: Math.max(0, ...Object.values(frequencies)),
    exactExerciseOnAllDays: Object.entries(frequencies)
      .filter(([, count]) => count >= days.length)
      .map(([slug]) => slug),
    pairwiseOverlap,
    movementDistribution,
    movementPatternCount: Object.keys(movementDistribution).length,
    mediaCoveragePercent: percentage(
      slots.filter((item) => item.mediaReady).length,
      slots.length,
    ),
    invalidEquipment:
      (plan.quality_metrics as { invalidEquipment?: string[] } | null)
        ?.invalidEquipment ?? [],
    ineligibleExercises:
      (plan.quality_metrics as { ineligibleExercises?: string[] } | null)
        ?.ineligibleExercises ?? [],
    frequencies,
  };
});

const movementCoverage = Object.fromEntries(
  [...new Set(catalog.map((exercise) => exercise.movementPattern))]
    .map((pattern) => [
      pattern,
      mediaReadyActive.filter(
        (exercise) => exercise.movementPattern === pattern,
      ).length,
    ])
    .sort(([left], [right]) => left.localeCompare(right)),
);
const muscleCoverage = Object.fromEntries(
  [...new Set(active.flatMap((exercise) => exercise.primaryMuscles))]
    .map((muscle) => [
      muscle,
      {
        active: active.filter((exercise) =>
          exercise.primaryMuscles.includes(muscle),
        ).length,
        mediaReady: mediaReadyActive.filter((exercise) =>
          exercise.primaryMuscles.includes(muscle),
        ).length,
      },
    ])
    .sort(([left], [right]) => left.localeCompare(right)),
);

const preference = reconciliation as {
  preferences?: unknown;
  goals?: unknown[];
  equipment?: string[];
  exercisePreferences?: unknown[];
  inProgressSessionIds?: unknown[];
};
const activePlanSlots = planReports.reduce(
  (total, plan) => total + plan.totalSlots,
  0,
);
const activePlanUniqueExercises = new Set(
  planReports.flatMap((plan) =>
    plan.days.flatMap((day) => day.exercises.map((exercise) => exercise.slug)),
  ),
).size;
const substitutionRelationships = substitutionsResult.error
  ? []
  : (substitutionsResult.data ?? []).map((relationship) => ({
      exercise:
        catalogById.get(relationship.exercise_id)?.slug ?? "missing_exercise",
      alternative:
        catalogById.get(relationship.alternative_exercise_id)?.slug ??
        "missing_exercise",
      score: relationship.score,
      sameMovementPattern: relationship.same_movement_pattern,
      samePrimaryMuscle: relationship.same_primary_muscle,
    }));

process.stdout.write(
  `${JSON.stringify(
    {
      auditedAt: new Date().toISOString(),
      projectRef: PROJECT_REF,
      readOnly: true,
      users: {
        authUsers: usersResult.data.users.length,
        profiles: profiles?.length ?? 0,
        onboarded: profiles?.filter((profile) => profile.onboarding_completed)
          .length,
      },
      storage: {
        bucket: "exercise-media",
        public: Boolean(bucketResult.data?.public),
      },
      metrics: {
        activeExercises: active.length,
        inactiveExercises: catalog.length - active.length,
        mediaReadyExercises: mediaReadyActive.length,
        mediaReadyPercent: percentage(mediaReadyActive.length, active.length),
        autoPlanEligibleExercises: autoPlanEligibleActive.length,
        totalMediaRecords: allMedia.length,
        approvedPrimaryMediaRecords: allMedia.filter(
          (media) =>
            media.status === "approved" &&
            media.media_role === "PRIMARY_DEMO" &&
            media.is_primary,
        ).length,
        activePlanSlots,
        activePlanUniqueExercises,
        activePlanUniquenessPercent: percentage(
          activePlanUniqueExercises,
          activePlanSlots,
        ),
      },
      mediaRecords: {
        status: distribution(allMedia.map((media) => media.status)),
        role: distribution(allMedia.map((media) => media.media_role)),
        type: distribution(allMedia.map((media) => media.media_type)),
        reviewState: distribution(allMedia.map((media) => media.review_state)),
      },
      movementCoverage,
      muscleCoverage,
      preferences: {
        training: preference.preferences ?? null,
        goalCount: preference.goals?.length ?? 0,
        equipment: preference.equipment ?? [],
        exercisePreferenceCount: preference.exercisePreferences?.length ?? 0,
        inProgressSessionCount: preference.inProgressSessionIds?.length ?? 0,
      },
      substitutions: substitutionsResult.error
        ? { accessible: false, count: null, reason: "least_privilege_acl" }
        : {
            accessible: true,
            count: substitutionRelationships.length,
            relationships: substitutionRelationships,
          },
      plans: planReports,
      catalog: catalog.map((exercise) => {
        const copy = { ...exercise } as typeof exercise & { id?: string };
        delete copy.id;
        return copy;
      }),
    },
    null,
    2,
  )}\n`,
);
