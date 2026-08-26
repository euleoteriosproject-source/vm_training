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
};

type GenerateRequest = { activation?: "immediate" | "preview" };

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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const payload = (await request.json().catch(() => ({}))) as GenerateRequest;
  const immediate = payload.activation === "immediate";

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
      .select("sessions_per_week,session_minutes,cardio_preference,experience,gym_category,gym_profile")
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
    supabase.rpc("get_auto_plan_catalog_v211"),
    supabase
      .from("workout_sessions")
      .select("workout_session_exercises(actual_exercise_id)")
      .eq("user_id", user.id)
      .in("status", ["completed", "cancelled"])
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
    category: row.category,
    difficulty: row.difficulty,
    active: row.active,
    hasApprovedMedia: row.media_ready,
    mediaReady: row.media_ready,
    autoPlanEligible: row.auto_plan_eligible,
    eligibilityReasons: row.eligibility_reasons ?? [],
    equipment: row.required_equipment ?? [],
    capabilities: row.required_capabilities ?? [],
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
      capabilities: capabilitiesForGym(gymProfile),
      equipment,
      unavailableEquipment,
      preferences: preferenceMap,
      movementAttentionPatterns,
      recentExerciseIds,
      generatorVersion: GENERATOR_VERSION,
    };
    const generated = generatePlanWithQuality(input, catalog);
    const { data: previewData, error: previewError } = await supabase.rpc(
      "create_plan_preview_v211",
      {
        p_days: generated.days,
        p_generator_version: generated.generatorVersion,
        p_rationale: {
          strategy: "goal-driven-capability-v211",
          quality: generated.quality,
          gymProfile,
          recentExerciseWindow: recentExerciseIds.length,
        },
      },
    );
    if (previewError) throw previewError;
    const result = previewData as {
      planId: string;
      quality: typeof generated.quality;
      goal: GoalCode;
    };

    if (immediate) {
      const { error: activationError } = await supabase.rpc(
        "activate_plan_v211",
        { p_plan_id: result.planId },
      );
      if (activationError) throw activationError;
    }

    return NextResponse.json(
      {
        id: result.planId,
        status: immediate ? ("active" as const) : ("draft" as const),
        generatorVersion: generated.generatorVersion,
        quality: result.quality,
        preview: {
          id: result.planId,
          goal: result.goal,
          daysPerWeek: generated.days.length,
          sessionMinutes: input.sessionMinutes,
          structure: generated.days.map((day) => day.name).join(" / "),
          exercisesPerDay: generated.days.map((day) => day.exercises.length),
          changes: changesForGoal(result.goal),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof PlanConstraintError)
      return NextResponse.json(
        {
          error: "Não foi possível gerar um plano seguro, variado e alinhado ao objetivo.",
          diagnostics: error.diagnostics,
        },
        { status: 422 },
      );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar o plano",
      },
      { status: 422 },
    );
  }
}
