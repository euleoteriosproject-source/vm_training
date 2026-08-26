import { notFound } from "next/navigation";
import Link from "next/link";
import { DayEditor } from "@/components/workout/day-editor";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
export default async function EditDayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: day }, { data: catalog }] = await Promise.all([
    supabase
      .from("workout_days")
      .select(
        "id,name,workout_plan:workout_plans(status),workout_day_exercises(id,exercise_id,position,target_sets,rep_min,rep_max,rest_seconds)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("exercises")
      .select("id,name_pt")
      .eq("active", true)
      .order("name_pt"),
  ]);
  if (!day) notFound();
  const plan = day.workout_plan as unknown as { status: string } | null;
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-accent">Personalizar</p>
      <h1 className="mt-1 mb-7 text-3xl font-semibold">{day.name}</h1>
      {plan?.status === "active" ? (
        <div className="rounded-2xl border bg-surface p-6">
          <h2 className="text-lg font-semibold">Composição versionada</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Para trocar um exercício ou incluir uma opção específica, use
            “Trocar” no card correspondente. O sistema mostrará uma troca
            equivalente ou uma prévia da reorganização antes de ativar uma nova
            versão. Seus treinos anteriores permanecem intactos.
          </p>
          <Button asChild className="mt-5">
            <Link href={`/workouts/${day.id}`}>Voltar à composição</Link>
          </Button>
        </div>
      ) : (
        <DayEditor
          dayId={day.id}
          initial={(day.workout_day_exercises ?? []).sort(
            (a, b) => a.position - b.position,
          )}
          catalog={catalog ?? []}
        />
      )}
    </div>
  );
}
