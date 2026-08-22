import { Card } from "@/components/ui/card";
import { MeasurementForm } from "@/components/progress/measurement-form";
import { ProgressChart } from "@/components/progress/progress-chart";
import { createClient } from "@/lib/supabase/server";
import {
  ageInYears,
  bodyMassIndex,
  weightTrend,
} from "@/lib/progress/calculations";
export default async function ProgressPage() {
  const supabase = await createClient();
  const [
    { data: measurements },
    { data: sessions },
    { data: profile },
    { data: attention },
  ] = await Promise.all([
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
    supabase.from("profiles").select("height_cm,birth_date").maybeSingle(),
    supabase
      .from("user_movement_attention")
      .select("region")
      .eq("active", true),
  ]);
  const chart = (measurements ?? []).map((item) => ({
    date: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(item.measured_at)),
    weight: Number(item.weight_kg),
  }));
  const current = measurements?.at(-1);
  const previous = measurements?.at(-2);
  const bmi =
    current && profile?.height_cm
      ? bodyMassIndex(Number(current.weight_kg), Number(profile.height_cm))
      : null;
  const age = profile?.birth_date ? ageInYears(profile.birth_date) : null;
  const regionNames: Record<string, string> = {
    knee: "joelho",
    shoulder: "ombro",
    lower_back: "lombar",
    hip: "quadril",
    ankle: "tornozelo",
    wrist: "punho",
    other: "outra região",
  };
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-accent">Evolução</p>
          <h1 className="mt-1 text-3xl font-semibold">Seu progresso</h1>
        </div>
        <MeasurementForm />
      </div>
      <section className="mt-7 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-5">
          <p className="text-sm font-medium text-accent">Seu corpo</p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SnapshotValue
              label="Peso atual"
              value={current ? `${current.weight_kg} kg` : "—"}
            />
            <SnapshotValue
              label="Altura"
              value={profile?.height_cm ? `${profile.height_cm} cm` : "—"}
            />
            <SnapshotValue
              label="IMC"
              value={bmi ? bmi.toFixed(1).replace(".", ",") : "—"}
            />
            <SnapshotValue
              label="Tendência"
              value={
                current
                  ? weightTrend(
                      Number(current.weight_kg),
                      previous ? Number(previous.weight_kg) : null,
                    )
                  : "Sem dados"
              }
            />
          </div>
          {current && (
            <p className="mt-5 text-xs text-muted">
              Última medição em{" "}
              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
                new Date(current.measured_at),
              )}
            </p>
          )}
          {bmi !== null && (
            <p className="mt-3 rounded-xl bg-surface-alt p-3 text-xs text-muted">
              O IMC é apenas um indicador de triagem e não substitui uma
              avaliação profissional.
              {age !== null && age < 20
                ? " Por você ter menos de 20 anos, não aplicamos classificação adulta."
                : ""}
            </p>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">Pontos de atenção</h2>
          {attention?.length ? (
            <p className="mt-3 text-sm text-muted">
              Você marcou atenção em{" "}
              {attention
                .map((item) => regionNames[item.region] ?? item.region)
                .join(", ")}
              . Isso será considerado nas substituições, sem representar
              diagnóstico.
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Nenhuma região de atenção registrada.
            </p>
          )}
          {!current && (
            <p className="mt-3 text-sm text-muted">
              Você ainda não registrou medidas recentes.
            </p>
          )}
        </Card>
      </section>
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

function SnapshotValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
