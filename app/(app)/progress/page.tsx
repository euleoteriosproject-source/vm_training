import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MeasurementForm } from "@/components/progress/measurement-form";
import { ProgressChart } from "@/components/progress/progress-chart";
import { createClient } from "@/lib/supabase/server";
import {
  ageInYears,
  adultBmiCategory,
  bodyMassIndex,
  weightChange,
  weightTrend,
} from "@/lib/progress/calculations";
export default async function ProgressPage() {
  const supabase = await createClient();
  const [{ data: measurements }, { data: profile }, { data: attention }] =
    await Promise.all([
      supabase
        .from("body_measurements")
        .select("id,measured_at,weight_kg,waist_cm,hips_cm,clothing_fit,notes")
        .order("measured_at", { ascending: true }),
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
  const bmiCategory = adultBmiCategory(bmi, age);
  const weightRows = (measurements ?? []).map((item) => ({
    weight: Number(item.weight_kg),
    measuredAt: item.measured_at,
  }));
  const change30 = weightChange(weightRows, 30);
  const change90 = weightChange(weightRows, 90);
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
              value={
                bmi
                  ? `${bmi.toFixed(1).replace(".", ",")}${bmiCategory ? ` · ${bmiCategory}` : ""}`
                  : "—"
              }
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
            <div className="mt-3 rounded-xl bg-surface-alt p-3 text-xs leading-5 text-muted">
              <p>
                O IMC é um indicador de triagem, não um diagnóstico. Considere-o
                junto com seu histórico e uma avaliação profissional.
              </p>
              {age !== null && age < 20 && (
                <p className="mt-2">
                  Para pessoas de 2 a 19 anos, a interpretação usa percentis por
                  idade e sexo. Como o perfil não reúne todos esses dados,
                  mostramos somente o valor e não aplicamos a classificação
                  adulta.
                </p>
              )}
            </div>
          )}
          {(change30 !== null || change90 !== null) && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {change30 !== null && <ChangeBadge days={30} value={change30} />}
              {change90 !== null && <ChangeBadge days={90} value={change90} />}
            </div>
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
      <Card className="mt-7 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-semibold">Histórico de treinos</h2>
          <p className="mt-1 text-sm text-muted">
            Consulte séries, carga, volume e repita sessões anteriores.
          </p>
        </div>
        <Link
          href="/workouts?view=history"
          className="inline-flex min-h-11 items-center rounded-xl bg-surface-alt px-4 text-sm font-semibold"
        >
          Ver histórico
        </Link>
      </Card>
    </div>
  );
}

function ChangeBadge({ days, value }: { days: number; value: number }) {
  const formatted = `${value > 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")} kg`;
  return (
    <span className="rounded-full bg-background px-3 py-1.5 text-muted">
      {days} dias: <strong className="text-foreground">{formatted}</strong>
    </span>
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
