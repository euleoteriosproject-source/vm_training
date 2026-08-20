import { notFound } from "next/navigation";
import { WorkoutRunner } from "@/components/workout/workout-runner";
import { createClient } from "@/lib/supabase/server";
export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("workout_sessions")
    .select(
      "id,started_at,status,workout_day:workout_days(name),workout_session_exercises(id,planned_exercise_id,actual_exercise_id,position,status,actual:exercises!workout_session_exercises_actual_exercise_id_fkey(id,name_pt,category,primary_muscles,secondary_muscles,execution_instructions,breathing_instruction,common_errors,exercise_equipment(equipment(name)),exercise_media(id,storage_path,poster_path,status,media_type,media_role,execution_quality,sort_order,is_primary,author,source_name,source_url,license_code,license_url,attribution_text)),set_logs(id,set_number,weight_kg,reps,duration_seconds,completed))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!session || session.status !== "in_progress") notFound();
  const raw = (session.workout_session_exercises ?? []).sort(
    (a, b) => a.position - b.position,
  );
  const exercises = await Promise.all(
    raw.map(async (row) => {
      const actual = row.actual as unknown as {
        name_pt: string;
        category: string;
        primary_muscles: string[];
        secondary_muscles: string[];
        execution_instructions: string[];
        breathing_instruction: string | null;
        common_errors: string[];
        exercise_equipment: {
          equipment: { name: string } | { name: string }[] | null;
        }[];
        exercise_media: {
          storage_path: string;
          poster_path: string | null;
          status: string;
          media_type: string;
          media_role: string | null;
          execution_quality: string;
          sort_order: number;
          is_primary: boolean;
          author: string | null;
          source_name: string | null;
          source_url: string | null;
          license_code: string | null;
          license_url: string | null;
          attribution_text: string | null;
        }[];
      } | null;
      const media = actual?.exercise_media
        ?.filter(
          (m) =>
            m.status === "approved" &&
            m.execution_quality === "approved" &&
            m.media_role === "PRIMARY_DEMO" &&
            m.is_primary &&
            m.media_type === "video",
        )
        .sort(
          (a, b) =>
            Number(b.is_primary) - Number(a.is_primary) ||
            a.sort_order - b.sort_order,
        )[0];
      let mediaUrl: string | null = null,
        posterUrl: string | null = null;
      if (media) {
        const [{ data: video }, { data: poster }] = await Promise.all([
          supabase.storage
            .from("exercise-media")
            .createSignedUrl(media.storage_path, 3600),
          media.poster_path
            ? supabase.storage
                .from("exercise-media")
                .createSignedUrl(media.poster_path, 3600)
            : Promise.resolve({ data: null }),
        ]);
        mediaUrl = video?.signedUrl ?? null;
        posterUrl = poster?.signedUrl ?? null;
      }
      return {
        id: row.id,
        actualExerciseId: row.actual_exercise_id,
        plannedExerciseId: row.planned_exercise_id,
        position: row.position,
        status: row.status,
        targetSets: (row.set_logs ?? []).length,
        repMin: 8,
        repMax: 12,
        restSeconds: 75,
        category: actual?.category ?? "strength",
        detail: {
          name: actual?.name_pt ?? "Exercício",
          primaryMuscles: actual?.primary_muscles ?? [],
          secondaryMuscles: actual?.secondary_muscles ?? [],
          instructions: actual?.execution_instructions ?? [],
          breathing: actual?.breathing_instruction ?? null,
          errors: actual?.common_errors ?? [],
          equipment: (actual?.exercise_equipment ?? []).flatMap((entry) => {
            const relation = entry.equipment;
            return Array.isArray(relation)
              ? relation.map((value) => value.name)
              : relation
                ? [relation.name]
                : [];
          }),
          mediaUrl,
          posterUrl,
          mediaSource: media
            ? {
                author: media.author,
                sourceName: media.source_name,
                sourceUrl: media.source_url,
                licenseCode: media.license_code,
                licenseUrl: media.license_url,
                attributionText: media.attribution_text,
              }
            : null,
        },
        sets: (row.set_logs ?? []).sort((a, b) => a.set_number - b.set_number),
      };
    }),
  );
  const day = session.workout_day as unknown as { name: string } | null;
  return (
    <WorkoutRunner
      sessionId={session.id}
      sessionName={day?.name ?? "Treino"}
      startedAt={session.started_at}
      exercises={exercises}
    />
  );
}
