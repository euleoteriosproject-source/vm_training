import { NextResponse } from "next/server";
import { generatePlan } from "@/lib/workouts/generator";
import type {
  ExerciseCandidate,
  GoalCode,
  PlanInput,
} from "@/lib/workouts/types";
import { createClient } from "@/lib/supabase/server";

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
    { data: exercises },
  ] = await Promise.all([
    supabase
      .from("training_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single(),
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
    supabase
      .from("exercises")
      .select(
        "id,name_pt,movement_pattern,category,difficulty,active,exercise_media(status,media_type,media_role,execution_quality,is_primary),exercise_equipment(required,equipment(slug))",
      ),
  ]);
  if (!preferences)
    return NextResponse.json(
      { error: "Preferências incompletas" },
      { status: 422 },
    );
  const equipment = (userEquipment ?? [])
    .map((row) => {
      const value = row.equipment as unknown as { slug: string } | null;
      return value?.slug;
    })
    .filter((v): v is string => Boolean(v));
  const preferenceMap = Object.fromEntries(
    (exercisePreferences ?? []).map((row) => [row.exercise_id, row.preference]),
  ) as PlanInput["preferences"];
  const catalog: ExerciseCandidate[] = (exercises ?? []).map((row) => ({
    id: row.id,
    name: row.name_pt,
    pattern: row.movement_pattern,
    category: row.category,
    difficulty: row.difficulty,
    active: row.active,
    hasApprovedMedia: (row.exercise_media ?? []).some(
      (m: {
        status: string;
        media_type: string;
        media_role: string | null;
        execution_quality: string;
        is_primary: boolean;
      }) =>
        m.status === "approved" &&
        m.execution_quality === "approved" &&
        m.media_role === "PRIMARY_DEMO" &&
        m.is_primary &&
        ["video", "gif"].includes(m.media_type),
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
  }));
  let createdPlanId: string | null = null;
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
    };
    const days = generatePlan(input, catalog, { draft: true });
    await supabase
      .from("workout_plans")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "draft");
    const { data: plan, error: planError } = await supabase
      .from("workout_plans")
      .insert({
        user_id: user.id,
        name: "Meu plano",
        status: "draft",
        source: "generated",
        sessions_per_week: input.sessionsPerWeek,
        target_session_minutes: input.sessionMinutes,
      })
      .select("id")
      .single();
    if (planError || !plan)
      throw planError ?? new Error("Falha ao criar plano");
    createdPlanId = plan.id;
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const { data: dayRow, error: dayError } = await supabase
        .from("workout_days")
        .insert({
          workout_plan_id: plan.id,
          name: day.name,
          position: i + 1,
          estimated_minutes: day.estimatedMinutes,
        })
        .select("id")
        .single();
      if (dayError || !dayRow)
        throw dayError ?? new Error("Falha ao criar dia");
      const { error: exerciseError } = await supabase
        .from("workout_day_exercises")
        .insert(
          day.exercises.map((exercise, position) => ({
            workout_day_id: dayRow.id,
            exercise_id: exercise.exerciseId,
            position: position + 1,
            target_sets: exercise.sets,
            rep_min: exercise.repMin || null,
            rep_max: exercise.repMax || null,
            rest_seconds: exercise.restSeconds,
            target_duration_seconds: exercise.targetDurationSeconds ?? null,
          })),
        );
      if (exerciseError) throw exerciseError;
    }
    const plannedIds = new Set(
      days.flatMap((day) => day.exercises.map((item) => item.exerciseId)),
    );
    const readyIds = new Set(
      catalog
        .filter((exercise) => exercise.active && exercise.hasApprovedMedia)
        .map((exercise) => exercise.id),
    );
    const primaryApproved = [...plannedIds].filter((id) => readyIds.has(id));
    const planCoverage = plannedIds.size
      ? Number(((primaryApproved.length / plannedIds.size) * 100).toFixed(1))
      : 0;
    let status: "draft" | "active" = "draft";
    if (planCoverage === 100) {
      const { error: activateError } = await supabase.rpc("activate_plan", {
        p_plan_id: plan.id,
      });
      if (activateError) throw activateError;
      status = "active";
    }
    return NextResponse.json(
      {
        id: plan.id,
        status,
        planCoverage,
        exercises: plannedIds.size,
        primaryApproved: primaryApproved.length,
      },
      { status: 201 },
    );
  } catch (error) {
    if (createdPlanId)
      await supabase.from("workout_plans").delete().eq("id", createdPlanId);
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
