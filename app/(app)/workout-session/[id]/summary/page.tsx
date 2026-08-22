import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StartButton } from "@/components/workout/start-button";
import { createClient } from "@/lib/supabase/server";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("workout_sessions")
    .select(
      "id,status,started_at,completed_at,duration_seconds,notes,cancellation_reason,workout_day_id,completion_percent,completed_sets,planned_sets,completed_exercises,planned_exercises,total_volume_kg,workout_day:workout_days(name),workout_session_exercises(id,status,position,actual:exercises!workout_session_exercises_actual_exercise_id_fkey(name_pt,category),set_logs(set_number,weight_kg,reps,duration_seconds,completed),cardio_logs(duration_seconds,distance_km,rpe))",
    )
    .eq("id", id)
    .in("status", ["completed", "cancelled"])
    .maybeSingle();
  if (!session) notFound();

  const exercises = (session.workout_session_exercises ?? []).sort(
    (a, b) => a.position - b.position,
  );
  const logs = exercises.flatMap((exercise) => exercise.set_logs ?? []);
  const completedSets =
    session.completed_sets ?? logs.filter((set) => set.completed).length;
  const plannedSets = session.planned_sets ?? logs.length;
  const completedExercises =
    session.completed_exercises ??
    exercises.filter((exercise) => exercise.status === "completed").length;
  const plannedExercises = session.planned_exercises ?? exercises.length;
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
  const completion =
    session.completion_percent ??
    (plannedSets ? Math.round((completedSets / plannedSets) * 100) : 0);
  const cardioMinutes = Math.round(
    exercises
      .flatMap((exercise) => exercise.cardio_logs ?? [])
      .reduce((sum, log) => sum + log.duration_seconds, 0) / 60,
  );
  const cancelled = session.status === "cancelled";
  const legacyInvalid =
    session.status === "completed" &&
    session.completion_percent === null &&
    completedSets === 0;
  const day = session.workout_day as unknown as { name: string } | null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="text-center">
        {cancelled ? (
          <XCircle size={52} className="mx-auto text-muted" />
        ) : (
          <CheckCircle2 size={52} className="mx-auto text-success" />
        )}
        <p className="mt-5 text-sm text-accent">{day?.name ?? "Treino"}</p>
        <h1 className="mt-1 text-3xl font-semibold">
          {cancelled ? "Treino cancelado" : "Resumo do treino"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(new Date(session.completed_at ?? session.started_at))}
        </p>
      </div>

      <Card className="mt-7 grid grid-cols-2 gap-5 p-6 sm:grid-cols-3">
        <Stat
          value={`${Math.round((session.duration_seconds ?? 0) / 60)} min`}
          label="duração"
        />
        <Stat value={`${completion}%`} label="conclusão" />
        <Stat value={`${completedSets}/${plannedSets}`} label="séries" />
        <Stat
          value={`${completedExercises}/${plannedExercises}`}
          label="exercícios"
        />
        <Stat value={`${Number(volume).toFixed(0)} kg`} label="volume" />
        <Stat value={`${cardioMinutes} min`} label="cardio" />
      </Card>

      {legacyInvalid && (
        <p className="mt-4 rounded-xl bg-warning/10 p-4 text-sm text-warning">
          Este registro anterior foi encerrado sem séries concluídas. Ele foi
          preservado exatamente como estava e não será usado para sugerir
          cargas.
        </p>
      )}
      {(session.notes || session.cancellation_reason) && (
        <Card className="mt-4 p-4">
          <p className="text-sm font-semibold">Observações</p>
          <p className="mt-2 text-sm text-muted">
            {session.notes ?? session.cancellation_reason}
          </p>
        </Card>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Exercícios e séries</h2>
        <div className="mt-4 space-y-3">
          {exercises.map((exercise) => {
            const actual = exercise.actual as unknown as {
              name_pt: string;
              category: string;
            } | null;
            return (
              <Card key={exercise.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">
                    {actual?.name_pt ?? "Exercício"}
                  </h3>
                  <span className="text-xs text-muted">
                    {exercise.status === "completed"
                      ? "Concluído"
                      : exercise.status === "skipped"
                        ? "Pulado"
                        : "Parcial"}
                  </span>
                </div>
                {actual?.category === "cardio" ? (
                  <p className="mt-2 text-sm text-muted">
                    {exercise.cardio_logs?.[0]?.duration_seconds
                      ? `${Math.round(exercise.cardio_logs[0].duration_seconds / 60)} min`
                      : "Sem atividade registrada"}
                  </p>
                ) : (
                  <div className="mt-3 space-y-1 text-sm text-muted">
                    {(exercise.set_logs ?? [])
                      .sort((a, b) => a.set_number - b.set_number)
                      .map((set) => (
                        <p key={set.set_number}>
                          Série {set.set_number}: {set.weight_kg ?? "—"} kg ·{" "}
                          {set.reps ?? "—"} reps ·{" "}
                          {set.completed ? "feita" : "não concluída"}
                        </p>
                      ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link href="/today">Concluir</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/workouts?view=history">Ver histórico</Link>
        </Button>
        {session.workout_day_id && !cancelled && (
          <StartButton dayId={session.workout_day_id} label="Repetir treino" />
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}
