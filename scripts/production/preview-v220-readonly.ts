import { generatePlanWithQuality } from "../../lib/workouts/generator.ts";
import { capabilitiesForGym } from "../../lib/workouts/gym-capabilities.ts";
import type { ExerciseCandidate, PlanInput } from "../../lib/workouts/types.ts";
import { getAdminClient } from "../media/shared.ts";

const PROJECT_REF = "inghftngeritrsezwxnm";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || new URL(url).hostname !== `${PROJECT_REF}.supabase.co`)
  throw new Error("Supabase project ref mismatch");
const client = getAdminClient()!;

type Reconciliation = {
  userId: string;
  preferences: {
    sessionsPerWeek: 2 | 3 | 4 | 5;
    sessionMinutes: 30 | 45 | 60 | 75 | 90;
    cardioPreference: 1 | 2 | 3 | 4 | 5;
    experience: PlanInput["experience"];
  };
  equipment: string[];
  exercisePreferences: Array<{ exerciseId: string; preference: "like" | "neutral" | "dislike" | "avoid" }>;
  movementAttentionPatterns: string[];
  recentExerciseIds: string[];
  catalog: Array<{
    id: string; equipment: string[]; mediaReady: boolean; autoPlanEligible: boolean;
    eligibilityReasons: string[];
  }>;
};

const [{ data: rawInput, error: inputError }, { data: metadata, error: metadataError }] = await Promise.all([
  client.rpc("get_v21_plan_reconciliation_input"),
  client.from("exercises").select(
    "id,name_pt,movement_pattern,training_role,category,difficulty,active,primary_muscles,secondary_muscles,environment_profile,gym_equipment_tier,technical_complexity,goal_suitability,exercise_family,fatigue_profile,stability_profile",
  ),
]);
if (inputError) throw inputError;
if (metadataError) throw metadataError;
const source = rawInput as Reconciliation;
const eligibility = new Map(source.catalog.map((exercise) => [exercise.id, exercise]));
const catalog: ExerciseCandidate[] = (metadata ?? []).map((exercise) => {
  const status = eligibility.get(exercise.id);
  return {
    id: exercise.id,
    name: exercise.name_pt,
    pattern: exercise.movement_pattern,
    trainingRole: exercise.training_role,
    category: exercise.category as ExerciseCandidate["category"],
    difficulty: exercise.difficulty as ExerciseCandidate["difficulty"],
    active: exercise.active,
    hasApprovedMedia: status?.mediaReady ?? false,
    mediaReady: status?.mediaReady ?? false,
    autoPlanEligible: status?.autoPlanEligible ?? false,
    eligibilityReasons: status?.eligibilityReasons ?? [],
    // The legacy reconciliation RPC already evaluated equipment/capabilities
    // server-side. Avoid applying its incomplete equipment-only projection a
    // second time; the live v2.2 endpoint uses get_auto_plan_catalog_v220.
    equipment: [],
    primaryMuscles: exercise.primary_muscles ?? [],
    secondaryMuscles: exercise.secondary_muscles ?? [],
    environmentProfile: exercise.environment_profile as ExerciseCandidate["environmentProfile"],
    gymEquipmentTier: exercise.gym_equipment_tier as ExerciseCandidate["gymEquipmentTier"],
    technicalComplexity: exercise.technical_complexity as ExerciseCandidate["technicalComplexity"],
    goalSuitability: exercise.goal_suitability ?? [],
    exerciseFamily: exercise.exercise_family,
    fatigueProfile: exercise.fatigue_profile as ExerciseCandidate["fatigueProfile"],
    stabilityProfile: exercise.stability_profile as ExerciseCandidate["stabilityProfile"],
  };
});
const gymProfile = "STANDARD_COMMERCIAL_GYM" as const;
const previewInput: PlanInput = {
  goals: [{ code: "muscle_gain", priority: 1 }],
  ...source.preferences,
  gymProfile,
  workoutStyle: "gym_first",
  equipment: source.equipment,
  capabilities: capabilitiesForGym(gymProfile),
  preferences: Object.fromEntries(source.exercisePreferences.map((item) => [item.exerciseId, item.preference])),
  movementAttentionPatterns: source.movementAttentionPatterns,
  recentExerciseIds: source.recentExerciseIds,
  catalogVersion: "production-v220",
};
let generated;
try {
  generated = generatePlanWithQuality(previewInput, catalog);
} catch (error) {
  const eligibleCatalog = catalog.filter((exercise) => exercise.autoPlanEligible && exercise.active && exercise.mediaReady);
  process.stderr.write(`${JSON.stringify({
    previewFailed: true,
    eligibleCount: eligibleCatalog.length,
    eligiblePatterns: Object.fromEntries(
      [...new Set(eligibleCatalog.map((exercise) => exercise.pattern))]
        .sort()
        .map((pattern) => [pattern, eligibleCatalog.filter((exercise) => exercise.pattern === pattern).length]),
    ),
  })}\n`);
  throw error;
}

const { data: activePlan, error: activePlanError } = await client
  .from("workout_plans")
  .select("generator_version,workout_days(workout_day_exercises(exercise_id))")
  .eq("user_id", source.userId)
  .eq("status", "active")
  .single();
if (activePlanError) throw activePlanError;
const priorIds = (activePlan.workout_days ?? []).flatMap((day) =>
  (day.workout_day_exercises ?? []).map((item) => item.exercise_id),
);
const names = new Map(catalog.map((exercise) => [exercise.id, exercise.name]));
process.stdout.write(`${JSON.stringify({
  projectRef: PROJECT_REF,
  readOnly: true,
  persisted: false,
  activated: false,
  comparison: {
    priorGenerator: activePlan.generator_version,
    priorSlots: priorIds.length,
    priorUnique: new Set(priorIds).size,
    previewGenerator: generated.generatorVersion,
    previewSlots: generated.quality.totalSlots,
    previewUnique: generated.quality.uniqueExercises,
  },
  architecture: generated.architecture,
  quality: generated.quality,
  days: generated.days.map((day) => ({
    name: day.name,
    focus: day.focus,
    exercises: day.exercises.map((exercise) => ({
      name: names.get(exercise.exerciseId),
      role: exercise.slotRole,
      family: exercise.exerciseFamily,
      prescription: `${exercise.sets}x${exercise.repMin}-${exercise.repMax} / ${exercise.restSeconds}s`,
      rationale: exercise.rationale,
      progression: exercise.progression?.state,
    })),
  })),
}, null, 2)}\n`);
