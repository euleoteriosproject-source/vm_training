import Link from "next/link";
import type { ReactNode } from "react";
import {
  ChevronRight,
  Clock3,
  Dumbbell,
  History,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StartButton } from "@/components/workout/start-button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const selected = view === "history" ? "history" : "plan";
  const supabase = await createClient();
  const [{ data: plans }, { data: sessions }, { data: inProgress }] =
    await Promise.all([
    supabase
      .from("workout_plans")
      .select(
        "id,name,status,created_at,target_session_minutes,workout_days(id,name,position,estimated_minutes,workout_day_exercises(count))",
      )
      .in("status", ["active", "draft"])
      .order("created_at", { ascending: false }),
    supabase
      .from("workout_sessions")
      .select(
        "id,workout_day_id,started_at,completed_at,duration_seconds,completion_percent,completed_sets,planned_sets,completed_exercises,planned_exercises,total_volume_kg,notes,workout_day:workout_days(name),workout_session_exercises(set_logs(completed,weight_kg,reps))",
      )
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(50),
    supabase
      .from("workout_sessions")
      .select("id,workout_plan_id")
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const plan =
    plans?.find((item) => item.status === "active") ??
    plans?.find((item) => item.status === "draft") ??
    null;
  const isDraft = plan?.status === "draft";
  const staleInProgress = Boolean(
    inProgress && plan?.status === "active" && inProgress.workout_plan_id !== plan.id,
  );
  const days = (plan?.workout_days ?? []).sort(
    (a, b) => a.position - b.position,
  );
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-accent">Treinos</p>
          <h1 className="mt-1 text-3xl font-semibold">
            {selected === "plan" ? (plan?.name ?? "Treinos") : "Histórico"}
          </h1>
        </div>
        {selected === "plan" && (
          <Button variant="secondary" asChild>
            <Link href="/profile#preferences">
              <RefreshCw size={17} />
              Recalcular
            </Link>
          </Button>
        )}
      </div>

      <nav
        aria-label="Visualização dos treinos"
        className="mt-6 grid grid-cols-2 rounded-xl bg-surface-alt p-1"
      >
        <ViewLink href="/workouts" active={selected === "plan"}>
          <Dumbbell size={17} /> Plano
        </ViewLink>
        <ViewLink href="/workouts?view=history" active={selected === "history"}>
          <History size={17} /> Histórico
        </ViewLink>
      </nav>

      {selected === "plan" ? (
        <>
          {isDraft && (
            <Card className="mt-6 border-warning/40 bg-warning/10 p-4 text-sm">
              Este é o seu rascunho personalizado. Ajuste as preferências e
              recalcule para ativar uma estrutura de treino válida. A ausência
              de vídeo não bloqueia o plano.
            </Card>
          )}
          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            {days.map((day) => (
              <Card key={day.id} className="p-5">
                <Link
                  href={`/workouts/${day.id}`}
                  className="group flex items-start justify-between"
                >
                  <div>
                    <p className="text-xl font-semibold">{day.name}</p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                      <Clock3 size={15} />
                      {day.estimated_minutes} min ·{" "}
                      {day.workout_day_exercises?.[0]?.count ?? 0} exercícios
                    </p>
                  </div>
                  <ChevronRight className="text-muted group-hover:text-accent" />
                </Link>
                {isDraft ? (
                  <p className="mt-6 rounded-xl bg-surface-alt p-3 text-center text-sm text-muted">
                    Rascunho disponível para consulta
                  </p>
                ) : (
                  <StartButton
                    dayId={day.id}
                    className="mt-6 w-full"
                    discardSessionId={
                      staleInProgress ? inProgress?.id : undefined
                    }
                  />
                )}
              </Card>
            ))}
            {days.length === 0 && (
              <Card className="col-span-full p-8 text-center">
                <h2 className="text-xl font-semibold">Nenhum plano ativo</h2>
                <p className="mt-2 text-muted">
                  Conclua suas preferências para gerar um treino compatível com
                  a academia escolhida. O vídeo é opcional.
                </p>
              </Card>
            )}
          </div>
        </>
      ) : (
        <div className="mt-7 space-y-3">
          {(sessions ?? []).map((session) => {
            const day = session.workout_day as unknown as {
              name: string;
            } | null;
            const logs =
              session.workout_session_exercises?.flatMap(
                (exercise) => exercise.set_logs ?? [],
              ) ?? [];
            const completedSets =
              session.completed_sets ??
              logs.filter((set) => set.completed).length;
            const plannedSets = session.planned_sets ?? logs.length;
            const volume =
              session.total_volume_kg ??
              logs.reduce(
                (sum, set) =>
                  sum +
                  (set.completed
                    ? Number(set.weight_kg ?? 0) * Number(set.reps ?? 0)
                    : 0),
                0,
              );
            const legacyInvalid =
              session.completion_percent === null && completedSets === 0;
            const completion =
              session.completion_percent ??
              (plannedSets
                ? Math.round((completedSets / plannedSets) * 100)
                : 0);
            return (
              <Card key={session.id} className="p-5">
                <Link
                  href={`/workout-session/${session.id}/summary`}
                  className="group flex items-start justify-between gap-4"
                >
                  <div>
                    <p className="font-semibold">{day?.name ?? "Treino"}</p>
                    <p className="mt-1 text-sm text-muted">
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "medium",
                      }).format(new Date(session.completed_at!))}{" "}
                      · {Math.round((session.duration_seconds ?? 0) / 60)} min
                    </p>
                  </div>
                  <ChevronRight className="shrink-0 text-muted group-hover:text-accent" />
                </Link>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                  <span>
                    {completedSets}/{plannedSets} séries
                  </span>
                  <span>{completion}% concluído</span>
                  <span>{Number(volume).toFixed(0)} kg de volume</span>
                </div>
                {legacyInvalid && (
                  <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                    Registro anterior sem séries concluídas. Mantido como foi
                    salvo.
                  </p>
                )}
                {session.workout_day_id && (
                  <StartButton
                    dayId={session.workout_day_id}
                    label="Repetir treino"
                    className="mt-4 w-full"
                  />
                )}
              </Card>
            );
          })}
          {!sessions?.length && (
            <Card className="p-8 text-center text-muted">
              Seu primeiro treino concluído aparecerá aqui.
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function ViewLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-muted",
        active && "bg-background text-foreground shadow-sm",
      )}
    >
      {children}
    </Link>
  );
}
