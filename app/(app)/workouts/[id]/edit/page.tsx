import { notFound } from "next/navigation";
import { DayEditor } from "@/components/workout/day-editor";
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
        "id,name,workout_day_exercises(id,exercise_id,position,target_sets,rep_min,rep_max,rest_seconds)",
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
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-accent">Personalizar</p>
      <h1 className="mt-1 mb-7 text-3xl font-semibold">{day.name}</h1>
      <DayEditor
        dayId={day.id}
        initial={(day.workout_day_exercises ?? []).sort(
          (a, b) => a.position - b.position,
        )}
        catalog={catalog ?? []}
      />
    </div>
  );
}
