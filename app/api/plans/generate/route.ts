import { NextResponse } from "next/server";
import {
  GENERATOR_VERSION,
  generatePlanWithQuality,
  PlanConstraintError,
} from "@/lib/workouts/generator";
import type {
  ExerciseCandidate,
  GoalCode,
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
};

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
    { data: catalogRows, error: catalogError },
    { data: recentSessions },
  ] = await Promise.all([
    supabase
      .from("training_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_goals")
      .select("goal_code,priority")
      .eq("user_id", user.id)
      .eq("active", true),
    supabase
      .from("user_equipment")
      .select("equipment_id,equipment(slug)")
      .eq("user_id", user.id)
      .eq("available", true),
    supabase
      .from("user_exercise_preferences")
      .select("exercise_id,preference")
      .eq("user_id", user.id),
    supabase.rpc("get_auto_plan_catalog"),
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

  const equipment = (userEquipment ?? [])
    .map((row) => {
      const value = row.equipment as unknown as { slug: string } | null;
      return value?.slug;
    })
    .filter((value): value is string => Boolean(value));
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
      equipment,
      preferences: preferenceMap,
      recentExerciseIds,
      generatorVersion: GENERATOR_VERSION,
    };
    const generated = generatePlanWithQuality(input, catalog);
    const { data: activation, error: activationError } = await supabase.rpc(
      "create_and_activate_plan_v21",
      {
        p_days: generated.days,
        p_generator_version: generated.generatorVersion,
        p_rationale: {
          strategy: "deterministic-diversity-v21",
          quality: generated.quality,
          recentExerciseWindow: recentExerciseIds.length,
        },
      },
    );
    if (activationError) throw activationError;
    const result = activation as {
      planId: string;
      quality: typeof generated.quality;
    };
    return NextResponse.json(
      {
        id: result.planId,
        status: "active" as const,
        generatorVersion: generated.generatorVersion,
        quality: result.quality,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof PlanConstraintError)
      return NextResponse.json(
        {
          error: "Não foi possível gerar um plano seguro e variado.",
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
