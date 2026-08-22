import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StartButton } from "@/components/workout/start-button";
import { createClient } from "@/lib/supabase/server";
export default async function WorkoutDayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: day } = await supabase
    .from("workout_days")
    .select(
      "id,name,estimated_minutes,workout_plan:workout_plans(status),workout_day_exercises(id,position,target_sets,rep_min,rep_max,rest_seconds,exercise:exercises(name_pt,primary_muscles))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!day) notFound();
  const plan = day.workout_plan as unknown as { status: string } | null;
  const isDraft = plan?.status === "draft";
  const items = (day.workout_day_exercises ?? []).sort(
    (a, b) => a.position - b.position,
  );
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-accent">
        {day.estimated_minutes} min estimados
      </p>
      <h1 className="mt-1 text-3xl font-semibold">{day.name}</h1>
      <div className="mt-6 flex gap-3">
        {isDraft ? (
          <p className="flex min-h-11 flex-1 items-center rounded-xl bg-warning/10 px-4 text-sm text-warning sm:flex-none">
            Rascunho para consulta — ajuste as preferências para ativar
          </p>
        ) : (
          <StartButton dayId={day.id} className="flex-1 sm:flex-none" />
        )}
        <Button variant="secondary" asChild>
          <Link href={`/workouts/${day.id}/edit`}>Editar</Link>
        </Button>
      </div>
      <div className="mt-7 space-y-3">
        {items.map((item, index) => {
          const ex = item.exercise as unknown as {
            name_pt: string;
            primary_muscles: string[];
          } | null;
          return (
            <Card key={item.id} className="flex items-center gap-4 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-alt text-sm text-muted">
                {index + 1}
              </span>
              <div>
                <h2 className="font-semibold">{ex?.name_pt}</h2>
                <p className="mt-1 text-sm text-muted">
                  {item.target_sets} séries · {item.rep_min}–{item.rep_max} reps
                  · {item.rest_seconds}s
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
