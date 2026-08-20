import { notFound } from "next/navigation";
import { ExerciseEditor } from "@/components/admin/exercise-editor";
import { createClient } from "@/lib/supabase/server";
export default async function EditExercisePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: exercise }, { data: media }] = await Promise.all([
    supabase.from("exercises").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("exercise_media")
      .select("id,storage_path,status,media_type,angle,attribution")
      .eq("exercise_id", id)
      .order("sort_order"),
  ]);
  if (!exercise) notFound();
  return (
    <div>
      <p className="text-sm text-accent">Catálogo</p>
      <h1 className="mt-1 mb-7 text-3xl font-semibold">{exercise.name_pt}</h1>
      <ExerciseEditor exercise={exercise} media={media ?? []} />
    </div>
  );
}
