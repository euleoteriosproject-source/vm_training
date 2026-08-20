import Link from "next/link";
import { ArrowRight, CalendarCheck, Scale, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StartButton } from "@/components/workout/start-button";
import { GeneratePlanButton } from "@/components/workout/generate-plan-button";
import { createClient } from "@/lib/supabase/server";
import { weeklyFrequency } from "@/lib/progress/calculations";

export default async function TodayPage() {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - 35);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [
    { data: profile },
    { data: plans },
    { data: sessions },
    { data: measurement },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").single(),
    supabase
      .from("workout_plans")
      .select(
        "id,name,status,sessions_per_week,created_at,workout_days(id,name,position,estimated_minutes,workout_day_exercises(exercise_id,exercise:exercises(name_pt,active,exercise_media(status,media_role,execution_quality,is_primary))))",
      )
      .in("status", ["active", "draft"])
      .order("created_at", { ascending: false }),
    supabase
      .from("workout_sessions")
      .select("completed_at")
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .gte("completed_at", since.toISOString()),
    supabase
      .from("body_measurements")
      .select("weight_kg,measured_at")
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const frequency = weeklyFrequency(
    (sessions ?? []).map((s) => ({ completedAt: s.completed_at! })),
    now,
  );
  const plan =
    plans?.find((item) => item.status === "active") ??
    plans?.find((item) => item.status === "draft") ??
    null;
  const isDraft = plan?.status === "draft";
  const days = (plan?.workout_days ?? []).sort(
    (a, b) => a.position - b.position,
  );
  const plannedExercises = new Map<
    string,
    { name: string; ready: boolean }
  >();
  for (const day of days)
    for (const item of day.workout_day_exercises ?? []) {
      const exercise = item.exercise as unknown as {
        name_pt?: string;
        active: boolean;
        exercise_media?: {
          status: string;
          media_role: string | null;
          execution_quality: string;
          is_primary: boolean;
        }[];
      } | null;
      plannedExercises.set(item.exercise_id, {
        name: exercise?.name_pt ?? "Exercício",
        ready:
          Boolean(exercise?.active) &&
          Boolean(
            exercise?.exercise_media?.some(
              (media) =>
                media.status === "approved" &&
                media.media_role === "PRIMARY_DEMO" &&
                media.execution_quality === "approved" &&
                media.is_primary,
            ),
          ),
      });
    }
  const readyExercises = [...plannedExercises.values()].filter(
    (item) => item.ready,
  ).length;
  const planCoverage = plannedExercises.size
    ? Math.round((readyExercises / plannedExercises.size) * 100)
    : 0;
  const blockers = [...plannedExercises.values()].filter((item) => !item.ready);
  const next = isDraft
    ? undefined
    : days[frequency % Math.max(days.length, 1)];
  return (
    <div>
      <p className="text-sm text-muted">
        {new Intl.DateTimeFormat("pt-BR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(now)}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Olá,{" "}
        {profile?.display_name?.split(" ")[0] ?? user?.email?.split("@")[0]}
      </h1>
      {next ? (
        <Card className="relative mt-8 overflow-hidden p-6 md:p-8">
          <div className="absolute -right-16 -top-20 size-64 rounded-full bg-accent/10 blur-3xl" />
          <p className="text-sm font-medium text-accent">Treino de hoje</p>
          <h2 className="mt-3 text-3xl font-semibold">{next.name}</h2>
          <p className="mt-2 flex items-center gap-2 text-muted">
            <Timer size={17} />
            {next.estimated_minutes} min ·{" "}
            {next.workout_day_exercises?.length ?? 0} exercícios
          </p>
          <StartButton dayId={next.id} className="mt-8 w-full sm:w-auto" />
        </Card>
      ) : isDraft ? (
        <Card className="mt-8 p-7">
          <p className="text-sm font-medium text-warning">Plano em preparação</p>
          <h2 className="mt-2 text-xl font-semibold">
            Seu rascunho foi criado
          </h2>
          <p className="mt-2 max-w-xl text-muted">
            Suas respostas já viraram um plano personalizado. Ele será liberado
            para treino quando todos os exercícios tiverem demonstração real
            revisada e aprovada.
          </p>
          <div className="mt-5 max-w-xl">
            <div className="flex justify-between text-sm">
              <span>Cobertura do plano</span>
              <span className="font-semibold">{planCoverage}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-alt">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${planCoverage}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              {readyExercises} de {plannedExercises.size} exercícios liberados
            </p>
          </div>
          {blockers.length > 0 && (
            <p className="mt-4 text-sm text-muted">
              Aguardando vídeos: {blockers.slice(0, 5).map((item) => item.name).join(", ")}
              {blockers.length > 5 ? ` e mais ${blockers.length - 5}` : ""}.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/workouts"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-surface-alt px-4 text-sm font-semibold"
            >
              Ver rascunho
            </Link>
            <GeneratePlanButton />
          </div>
        </Card>
      ) : (
        <Card className="mt-8 p-7">
          <h2 className="text-xl font-semibold">
            Seu plano ainda não está pronto
          </h2>
          <p className="mt-2 max-w-xl text-muted">
            Seu cadastro e suas respostas foram salvos. O plano não foi gerado
            porque o catálogo ainda não possui exercícios suficientes com vídeo
            revisado e aprovado para montar um treino seguro.
          </p>
          <GeneratePlanButton />
        </Card>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <CalendarCheck className="text-accent" />
          <p className="mt-5 text-2xl font-semibold">
            {frequency} de {plan?.sessions_per_week ?? 0}
          </p>
          <p className="text-sm text-muted">treinos nesta semana</p>
        </Card>
        <Card className="p-5">
          <Scale className="text-accent" />
          <p className="mt-5 text-2xl font-semibold">
            {measurement ? `${measurement.weight_kg} kg` : "—"}
          </p>
          <p className="text-sm text-muted">peso atual</p>
        </Card>
        <Link href="/progress">
          <Card className="flex h-full min-h-28 items-center justify-between p-5 transition hover:border-accent">
            <div>
              <p className="font-semibold">Sua evolução</p>
              <p className="mt-1 text-sm text-muted">Últimas 4 semanas</p>
            </div>
            <ArrowRight className="text-accent" />
          </Card>
        </Link>
      </div>
      <p className="mt-8 text-xs text-muted">
        Interrompa o exercício se sentir dor incomum ou mal-estar. Procure
        orientação profissional quando necessário.
      </p>
    </div>
  );
}
