import { NextResponse } from "next/server";
import {
  GENERATOR_VERSION,
  generatePlanWithQuality,
  PlanConstraintError,
} from "@/lib/workouts/generator";
import {
  capabilitiesForGym,
  gymCategoryToProfile,
} from "@/lib/workouts/gym-capabilities";
import type {
  ExerciseCandidate,
  GoalCode,
  GymProfile,
  PlanInput,
  WorkoutStyle,
} from "@/lib/workouts/types";
import { createClient } from "@/lib/supabase/server";

type AutoPlanCatalogRow = {
  id: string;
  name: string;
  pattern: string;
  category: ExerciseCandidate["category"];
  difficulty: ExerciseCandidate["difficulty"];
  active: boolean;
  media_ready: boolean;
  auto_plan_eligible: boolean;
  eligibility_reasons: string[] | null;
  required_equipment: string[] | null;
  required_capabilities: string[] | null;
  training_role: string;
  environment_profile: ExerciseCandidate["environmentProfile"];
  gym_equipment_tier: ExerciseCandidate["gymEquipmentTier"];
  technical_complexity: ExerciseCandidate["technicalComplexity"];
  goal_suitability: GoalCode[] | null;
  primary_muscles: string[] | null;
  secondary_muscles: string[] | null;
  exercise_family: string;
  fatigue_profile: ExerciseCandidate["fatigueProfile"];
  stability_profile: ExerciseCandidate["stabilityProfile"];
};

const attentionPatterns: Record<string, string[]> = {
  knee: ["squat", "knee_extension", "knee_flexion"],
  shoulder: ["horizontal_push", "vertical_push"],
  lower_back: ["hinge", "hip_extension", "core_flexion"],
  hip: ["squat", "hinge", "hip_extension"],
  ankle: ["squat", "knee_extension", "cardio"],
  wrist: ["horizontal_push", "vertical_push", "carry"],
};

function changesForGoal(goal: GoalCode) {
  if (goal === "strength")
    return ["mais foco em força", "faixas de repetição menores", "descansos mais longos"];
  if (goal === "muscle_gain")
    return ["mais volume de força e massa muscular", "compostos e acessórios equilibrados"];
  if (["conditioning", "cardio_endurance", "fat_loss", "weight_loss", "measurements"].includes(goal))
    return ["maior presença de condicionamento", "força de base preservada", "sessões mais densas"];
  if (["mobility", "posture"].includes(goal))
    return ["mais qualidade de movimento", "mobilidade e postura distribuídas na semana"];
  return ["força, condicionamento e movimento em equilíbrio"];
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const [
    { data: preferences },
    { data: goals },
    { data: userEquipment },
    { data: exercisePreferences },
    { data: movementAttention },
    { data: catalogRows, error: catalogError },
    { data: recentSessions },
  ] = await Promise.all([
    supabase
      .from("training_preferences")
      .select("sessions_per_week,session_minutes,cardio_preference,experience,gym_category,gym_profile,workout_style")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_goals")
      .select("goal_code,priority")
      .eq("user_id", user.id)
      .eq("active", true),
    supabase
      .from("user_equipment")
      .select("available,source,temporary_unavailable_until,equipment(slug)")
      .eq("user_id", user.id),
    supabase
      .from("user_exercise_preferences")
      .select("exercise_id,preference")
      .eq("user_id", user.id),
    supabase
      .from("user_movement_attention")
      .select("region")
      .eq("user_id", user.id)
      .eq("active", true),
    supabase.rpc("get_auto_plan_catalog_v220"),
    supabase
      .from("workout_sessions")
      .select("completed_at,workout_day_id,workout_session_exercises(position,actual_exercise_id,set_logs(weight_kg,reps,rpe,completed))")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(10),
  ]);

  if (!preferences)
    return NextResponse.json(
      { error: "Preferências incompletas" },
      { status: 422 },
    );
  if (catalogError)
    return NextResponse.json(
      { error: "Não foi possível validar o catálogo de exercícios." },
      { status: 422 },
    );

  const equipmentRows = (userEquipment ?? []).map((row) => ({
    available: row.available,
    source: row.source,
    unavailableUntil: row.temporary_unavailable_until,
    slug: (row.equipment as unknown as { slug: string } | null)?.slug,
  }));
  const equipment = equipmentRows
    .filter((row) => row.available)
    .map((row) => row.slug)
    .filter((value): value is string => Boolean(value));
  const now = Date.now();
  const unavailableEquipment = equipmentRows
    .filter(
      (row) =>
        row.source === "user_override" &&
        (!row.available ||
          (row.unavailableUntil && new Date(row.unavailableUntil).getTime() > now)),
    )
    .map((row) => row.slug)
    .filter((value): value is string => Boolean(value));
  const gymProfile = (preferences.gym_profile ??
    gymCategoryToProfile(preferences.gym_category)) as GymProfile;
  const preferenceMap = Object.fromEntries(
    (exercisePreferences ?? []).map((row) => [row.exercise_id, row.preference]),
  ) as PlanInput["preferences"];
  const catalog: ExerciseCandidate[] = (
    (catalogRows ?? []) as AutoPlanCatalogRow[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    pattern: row.pattern,
    trainingRole: row.training_role,
    category: row.category,
    difficulty: row.difficulty,
    active: row.active,
    hasApprovedMedia: row.media_ready,
    mediaReady: row.media_ready,
    autoPlanEligible: row.auto_plan_eligible,
    eligibilityReasons: row.eligibility_reasons ?? [],
    equipment: row.required_equipment ?? [],
    capabilities: row.required_capabilities ?? [],
    environmentProfile: row.environment_profile,
    gymEquipmentTier: row.gym_equipment_tier,
    technicalComplexity: row.technical_complexity,
    goalSuitability: row.goal_suitability ?? [],
    primaryMuscles: row.primary_muscles ?? [],
    secondaryMuscles: row.secondary_muscles ?? [],
    exerciseFamily: row.exercise_family,
    fatigueProfile: row.fatigue_profile,
    stabilityProfile: row.stability_profile,
  }));
  const recentExerciseIds = [
    ...new Set(
      (recentSessions ?? []).flatMap((session) =>
        (session.workout_session_exercises ?? []).map(
          (exercise) => exercise.actual_exercise_id,
        ),
      ),
    ),
  ];
  const recentDayIds = [
    ...new Set((recentSessions ?? []).map((session) => session.workout_day_id).filter(Boolean)),
  ] as string[];
  const { data: recentPrescriptions } = recentDayIds.length
    ? await supabase
        .from("workout_day_exercises")
        .select("workout_day_id,position,target_sets,rep_min,rep_max")
        .in("workout_day_id", recentDayIds)
    : { data: [] };
  const prescriptionBySlot = new Map(
    (recentPrescriptions ?? []).map((item) => [
      `${item.workout_day_id}:${item.position}`,
      item,
    ]),
  );
  const performanceHistory = (recentSessions ?? []).flatMap((session) =>
    (session.workout_session_exercises ?? []).map((exercise) => {
      const prescription = prescriptionBySlot.get(`${session.workout_day_id}:${exercise.position}`);
      const completedSets = (exercise.set_logs ?? []).filter((set) => set.completed);
      return {
        exerciseId: exercise.actual_exercise_id,
        completedAt: session.completed_at ?? "",
        prescribedSets: prescription?.target_sets ?? exercise.set_logs?.length ?? 0,
        completedSets: completedSets.length,
        prescribedRepMin: prescription?.rep_min ?? 0,
        prescribedRepMax: prescription?.rep_max ?? 0,
        actualReps: completedSets.flatMap((set) => set.reps == null ? [] : [set.reps]),
        loadKg: completedSets.flatMap((set) => set.weight_kg == null ? [] : [set.weight_kg]),
        rpe: completedSets.find((set) => set.rpe != null)?.rpe ?? undefined,
      };
    }),
  );
  const movementAttentionPatterns = [
    ...new Set(
      (movementAttention ?? []).flatMap(
        (attention) => attentionPatterns[attention.region] ?? [],
      ),
    ),
  ];

  try {
    const input: PlanInput = {
      goals: (goals ?? []).map((goal) => ({
        code: goal.goal_code as GoalCode,
        priority: goal.priority,
      })),
      sessionsPerWeek: preferences.sessions_per_week,
      sessionMinutes: preferences.session_minutes,
      cardioPreference: preferences.cardio_preference,
      experience: preferences.experience,
      gymProfile,
      workoutStyle: (preferences.workout_style ?? "gym_first") as WorkoutStyle,
      capabilities: capabilitiesForGym(gymProfile),
      equipment,
      unavailableEquipment,
      preferences: preferenceMap,
      movementAttentionPatterns,
      recentExerciseIds,
      performanceHistory,
      catalogVersion: "production-v221",
      generatorVersion: GENERATOR_VERSION,
    };
    const generated = generatePlanWithQuality(input, catalog);
    const { data: previewData, error: previewError } = await supabase.rpc(
      "create_plan_preview_v221",
      {
        p_days: generated.days,
        p_generator_version: generated.generatorVersion,
        p_rationale: {
          strategy: "programming-needs-smart-slot-v221",
          architecture: generated.architecture,
          selectedSlots: generated.slots,
          prunedSlots: generated.prunedSlots,
          quality: generated.quality,
          gymProfile,
          workoutStyle: input.workoutStyle,
          recentExerciseWindow: recentExerciseIds.length,
          performanceRecordCount: performanceHistory.length,
        },
      },
    );
    if (previewError) throw previewError;
    const result = previewData as {
      planId: string;
      goal: GoalCode;
    };

    const catalogById = new Map(catalog.map((exercise) => [exercise.id, exercise]));
    return NextResponse.json(
      {
        id: result.planId,
        status: "draft" as const,
        generatorVersion: generated.generatorVersion,
        preview: {
          id: result.planId,
          goal: result.goal,
          daysPerWeek: generated.days.length,
          sessionMinutes: input.sessionMinutes,
          structure: generated.days.map((day) => day.name).join(" / "),
          exercisesPerDay: generated.days.map((day) => day.exercises.length),
          changes: changesForGoal(result.goal),
          gymEquipmentSlots: generated.quality.gymEquipmentSlots,
          gymEquipmentPercent: generated.quality.gymEquipmentPercent,
          machineCableSlots: generated.quality.machineCableSlots,
          freeWeightSlots: generated.quality.freeWeightSlots,
          bodyweightFloorSlots: generated.quality.bodyweightFloorSlots,
          bodyweightPercent: generated.quality.bodyweightPercent,
          architecture: generated.architecture,
          days: generated.days.map((day) => ({
            name: day.name,
            focus: day.focus,
            exercises: day.exercises.map((exercise) => ({
              name: catalogById.get(exercise.exerciseId)?.name ?? "Exercício",
              role: exercise.slotRole,
              sets: exercise.sets,
              repMin: exercise.repMin,
              repMax: exercise.repMax,
              restSeconds: exercise.restSeconds,
              rationale: exercise.rationale,
              progression: exercise.progression,
            })),
          })),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof PlanConstraintError)
      return NextResponse.json(
        {
          error: "Não foi possível gerar um plano seguro, variado e alinhado ao objetivo.",
        },
        { status: 422 },
      );
    return NextResponse.json(
      {
        error: "Não foi possível gerar o plano.",
      },
      { status: 422 },
    );
  }
}
