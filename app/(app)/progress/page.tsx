import { Card } from "@/components/ui/card";
import { MeasurementForm } from "@/components/progress/measurement-form";
import { ProgressChart } from "@/components/progress/progress-chart";
import { createClient } from "@/lib/supabase/server";
export default async function ProgressPage() {
  const supabase = await createClient();
  const [{ data: measurements }, { data: sessions }] = await Promise.all([
    supabase
      .from("body_measurements")
      .select("id,measured_at,weight_kg,waist_cm,hips_cm,clothing_fit,notes")
      .order("measured_at", { ascending: true }),
    supabase
      .from("workout_sessions")
      .select(
        "id,started_at,completed_at,duration_seconds,workout_day:workout_days(name),workout_session_exercises(id,actual:exercises!workout_session_exercises_actual_exercise_id_fkey(name_pt),set_logs(weight_kg,reps,completed))",
      )
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(30),
  ]);
  const chart = (measurements ?? []).map((item) => ({
    date: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(item.measured_at)),
    weight: Number(item.weight_kg),
  }));
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-accent">Evolução</p>
          <h1 className="mt-1 text-3xl font-semibold">Seu progresso</h1>
        </div>
        <MeasurementForm />
      </div>
      <section className="mt-7">
        <Card className="p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Peso</h2>
            <p className="text-sm text-muted">
              Evolução corporal ao longo do tempo
            </p>
          </div>
          <ProgressChart data={chart} dataKey="weight" unit="kg" />
        </Card>
      </section>
      <section id="history" className="mt-9 scroll-mt-8">
        <h2 className="text-xl font-semibold">Histórico</h2>
        <div className="mt-4 space-y-3">
          {(sessions ?? []).map((session) => {
            const day = session.workout_day as unknown as {
              name: string;
            } | null;
            const sets =
              session.workout_session_exercises
                ?.flatMap((e) => e.set_logs ?? [])
                .filter((s) => s.completed).length ?? 0;
            return (
              <Card key={session.id} className="p-4">
                <div className="flex justify-between gap-4">
                  <div>
                    <p className="font-semibold">{day?.name ?? "Treino"}</p>
                    <p className="mt-1 text-sm text-muted">
                      {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "medium",
                      }).format(new Date(session.completed_at!))}{" "}
                      · {Math.round((session.duration_seconds ?? 0) / 60)} min
                    </p>
                  </div>
                  <span className="text-sm text-muted">{sets} séries</span>
                </div>
              </Card>
            );
          })}
          {!sessions?.length && (
            <Card className="p-8 text-center text-muted">
              Seu primeiro treino concluído aparecerá aqui.
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
