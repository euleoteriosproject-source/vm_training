import Link from "next/link";
import { Activity, ArrowRight, CalendarCheck, Play, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { GeneratePlanButton } from "@/components/workout/generate-plan-button";
import { StartButton } from "@/components/workout/start-button";
import {
  ageInYears,
  adultBmiCategory,
  bodyMassIndex,
  weeklyFrequency,
  weightTrend,
} from "@/lib/progress/calculations";
import { createClient } from "@/lib/supabase/server";

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
    { data: inProgress },
    { data: measurements },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name,birth_date,height_cm")
      .maybeSingle(),
    supabase
      .from("workout_plans")
      .select(
        "id,name,status,sessions_per_week,created_at,workout_days(id,name,position,estimated_minutes,workout_day_exercises(exercise_id))",
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
      .from("workout_sessions")
      .select("id,started_at,workout_day:workout_days(name)")
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("body_measurements")
      .select("weight_kg,measured_at")
      .order("measured_at", { ascending: false })
      .limit(2),
  ]);
  const frequency = weeklyFrequency(
    (sessions ?? []).map((session) => ({ completedAt: session.completed_at! })),
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
  const next = isDraft ? undefined : days[frequency % Math.max(days.length, 1)];
  const currentMeasurement = measurements?.[0];
  const previousMeasurement = measurements?.[1];
  const bmi =
    currentMeasurement && profile?.height_cm
      ? bodyMassIndex(
          Number(currentMeasurement.weight_kg),
          Number(profile.height_cm),
        )
      : null;
  const age = profile?.birth_date ? ageInYears(profile.birth_date, now) : null;
  const bmiCategory = adultBmiCategory(bmi, age);

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

      {inProgress && (
        <Card className="mt-8 border-accent/40 bg-accent/10 p-5">
          <p className="text-sm font-medium text-accent">Treino em andamento</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">
                {(inProgress.workout_day as unknown as { name: string } | null)
                  ?.name ?? "Treino"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Iniciado às{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(inProgress.started_at))}
              </p>
            </div>
            <Link
              href={`/workout-session/${inProgress.id}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground"
            >
              <Play size={17} fill="currentColor" />
              Retomar treino
            </Link>
          </div>
        </Card>
      )}

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
          <p className="text-sm font-medium text-warning">
            Plano em configuração
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            Seu rascunho está salvo
          </h2>
          <p className="mt-2 max-w-xl text-muted">
            Gere novamente para validar a estrutura e ativá-lo. Demonstrações em
            GIF não bloqueiam o treino.
          </p>
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
            Vamos criar seu primeiro plano
          </h2>
          <p className="mt-2 max-w-xl text-muted">
            A disponibilidade de mídia não interfere na criação do treino.
          </p>
          <GeneratePlanButton />
        </Card>
      )}

      <Link href="/progress" className="mt-5 block">
        <Card className="overflow-hidden border-accent/25 bg-gradient-to-br from-accent/10 via-surface to-surface p-5 transition hover:border-accent">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-accent">Seu corpo</p>
              <h2 className="mt-1 text-xl font-semibold">
                Acompanhe sem complicação
              </h2>
            </div>
            <Activity className="text-accent" />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted">Peso atual</p>
              <p className="mt-1 font-semibold">
                {currentMeasurement
                  ? `${currentMeasurement.weight_kg} kg`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">IMC</p>
              <p className="mt-1 font-semibold">
                {bmi ? bmi.toFixed(1).replace(".", ",") : "—"}
              </p>
              {bmiCategory && (
                <p className="mt-0.5 text-[11px] text-muted">{bmiCategory}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted">Tendência</p>
              <p className="mt-1 text-sm font-semibold">
                {currentMeasurement
                  ? weightTrend(
                      Number(currentMeasurement.weight_kg),
                      previousMeasurement
                        ? Number(previousMeasurement.weight_kg)
                        : null,
                    )
                  : "Sem dados"}
              </p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted">
            <span>
              {currentMeasurement
                ? `Atualizado em ${new Intl.DateTimeFormat("pt-BR").format(new Date(currentMeasurement.measured_at))}`
                : "Registre sua primeira medida"}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 font-medium text-accent">
              Ver detalhes <ArrowRight size={14} />
            </span>
          </div>
          {age !== null && age < 20 && bmi !== null && (
            <p className="mt-3 text-xs text-muted">
              Para menores de 20 anos, mostramos apenas o valor, sem
              classificação adulta.
            </p>
          )}
        </Card>
      </Link>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <CalendarCheck className="text-accent" />
          <p className="mt-5 text-2xl font-semibold">
            {frequency} de {plan?.sessions_per_week ?? 0}
          </p>
          <p className="text-sm text-muted">treinos nesta semana</p>
        </Card>
        <Link href="/progress">
          <Card className="flex h-full min-h-28 items-center justify-between p-5 transition hover:border-accent">
            <div>
              <p className="font-semibold">Sua evolução</p>
              <p className="mt-1 text-sm text-muted">Medidas e histórico</p>
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
