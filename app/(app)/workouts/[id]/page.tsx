import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StartButton } from "@/components/workout/start-button";
import { ExerciseDetails } from "@/components/exercise/exercise-details";
import { PlanExerciseSwap } from "@/components/workout/plan-exercise-swap";
import { ViewportVideo } from "@/components/video/viewport-video";
import { createClient } from "@/lib/supabase/server";
export default async function WorkoutDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ swap?: string }>;
}) {
  const { id } = await params;
  const { swap: requestedSwap } = await searchParams;
  const supabase = await createClient();
  const { data: day } = await supabase
    .from("workout_days")
    .select(
      "id,name,estimated_minutes,workout_plan:workout_plans(id,status),workout_day_exercises(id,position,target_sets,rep_min,rep_max,rest_seconds,exercise:exercises(name_pt,primary_muscles,secondary_muscles,execution_instructions,breathing_instruction,common_errors,exercise_equipment(equipment(name)),exercise_media(storage_path,poster_path,status,media_type,media_role,execution_quality,is_primary,sort_order,author,source_name,source_url,license_code,license_url,attribution_text)))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!day) notFound();
  const plan = day.workout_plan as unknown as { status: string } | null;
  const isDraft = plan?.status === "draft";
  const items = (day.workout_day_exercises ?? []).sort(
    (a, b) => a.position - b.position,
  );
  const prepared = await Promise.all(
    items.map(async (item) => {
      const exercise = item.exercise as unknown as {
        name_pt: string;
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
          is_primary: boolean;
          sort_order: number;
          author: string | null;
          source_name: string | null;
          source_url: string | null;
          license_code: string | null;
          license_url: string | null;
          attribution_text: string | null;
        }[];
      } | null;
      const media = exercise?.exercise_media
        ?.filter(
          (candidate) =>
            candidate.status === "approved" &&
            candidate.execution_quality === "approved" &&
            candidate.media_role === "PRIMARY_DEMO" &&
            candidate.is_primary,
        )
        .sort((a, b) => a.sort_order - b.sort_order)[0];
      const [{ data: demo }, { data: poster }] = media
        ? await Promise.all([
            supabase.storage
              .from("exercise-media")
              .createSignedUrl(media.storage_path, 3600),
            media.poster_path
              ? supabase.storage
                  .from("exercise-media")
                  .createSignedUrl(media.poster_path, 3600)
              : Promise.resolve({ data: null }),
          ])
        : [{ data: null }, { data: null }];
      return {
        ...item,
        detail: {
          name: exercise?.name_pt ?? "Exercício",
          primaryMuscles: exercise?.primary_muscles ?? [],
          secondaryMuscles: exercise?.secondary_muscles ?? [],
          instructions: exercise?.execution_instructions ?? [],
          breathing: exercise?.breathing_instruction ?? null,
          errors: exercise?.common_errors ?? [],
          equipment: (exercise?.exercise_equipment ?? []).flatMap((entry) => {
            if (Array.isArray(entry.equipment))
              return entry.equipment.map((equipment) => equipment.name);
            return entry.equipment ? [entry.equipment.name] : [];
          }),
          mediaUrl: demo?.signedUrl ?? null,
          posterUrl: poster?.signedUrl ?? null,
          mediaType:
            media?.media_type === "gif"
              ? ("gif" as const)
              : media
                ? ("video" as const)
                : null,
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
      };
    }),
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
          <Link href={`/workouts/${day.id}/edit`}>Editar composição</Link>
        </Button>
      </div>
      <div className="mt-7 space-y-3">
        {prepared.map((item, index) => (
          <Card
            key={item.id}
            className="grid overflow-hidden sm:grid-cols-[140px_1fr]"
          >
            <ViewportVideo
              src={item.detail.mediaUrl}
              poster={item.detail.posterUrl}
              mediaType={item.detail.mediaType}
              className="aspect-video h-full w-full sm:aspect-auto"
              priority={index === 0}
            />
            <div className="p-4">
              <div className="flex items-center gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-alt text-sm text-muted">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h2 className="font-semibold">{item.detail.name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {item.target_sets} séries · {item.rep_min}–{item.rep_max}{" "}
                    reps · {item.rest_seconds}s
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2 border-t pt-3">
                <ExerciseDetails
                  exercise={item.detail}
                  prescription={{
                    sets: item.target_sets,
                    repMin: item.rep_min,
                    repMax: item.rep_max,
                    restSeconds: item.rest_seconds,
                  }}
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex-1 sm:flex-none"
                      aria-label={`Ver detalhes de ${item.detail.name}`}
                    >
                      Ver detalhes
                    </Button>
                  }
                />
                {!isDraft && plan?.status === "active" && (
                  <PlanExerciseSwap
                    slotId={item.id}
                    exerciseName={item.detail.name}
                    initialOpen={requestedSwap === item.id}
                  />
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
