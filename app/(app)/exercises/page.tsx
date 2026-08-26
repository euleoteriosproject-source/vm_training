import { ExerciseLibrary, type ExerciseLibraryItem } from "@/components/exercise/exercise-library";
import { createClient } from "@/lib/supabase/server";

type CatalogRow = {
  id: string;
  media_ready: boolean;
  auto_plan_eligible: boolean;
};

export default async function ExercisesPage() {
  const supabase = await createClient();
  const [exerciseResult, catalogResult] = await Promise.all([
    supabase
      .from("exercises")
      .select(
        "id,slug,name_pt,movement_pattern,difficulty,primary_muscles,secondary_muscles,execution_instructions,breathing_instruction,common_errors,exercise_equipment(required,equipment(slug,name)),exercise_media(storage_path,poster_path,status,media_type,media_role,execution_quality,is_primary,review_state,author,source_name,source_url,license_code,license_url,attribution_text)",
      )
      .eq("active", true)
      .order("name_pt"),
    supabase.rpc("get_auto_plan_catalog"),
  ]);
  if (exerciseResult.error) throw exerciseResult.error;
  if (catalogResult.error) throw catalogResult.error;

  const catalog = new Map(
    ((catalogResult.data ?? []) as CatalogRow[]).map((row) => [row.id, row]),
  );
  const items = await Promise.all(
    (exerciseResult.data ?? []).map(async (exercise) => {
      const readiness = catalog.get(exercise.id);
      const media = readiness?.media_ready
        ? exercise.exercise_media?.find(
            (entry) =>
              entry.status === "approved" &&
              entry.execution_quality === "approved" &&
              entry.media_role === "PRIMARY_DEMO" &&
              entry.review_state === "PUBLISHED" &&
              entry.is_primary &&
              entry.storage_path,
          )
        : null;
      const [motion, poster] = media
        ? await Promise.all([
            supabase.storage
              .from("exercise-media")
              .createSignedUrl(media.storage_path!, 3600),
            media.poster_path
              ? supabase.storage
                  .from("exercise-media")
                  .createSignedUrl(media.poster_path, 3600)
              : Promise.resolve({ data: null }),
          ])
        : [{ data: null }, { data: null }];
      const equipment = (exercise.exercise_equipment ?? [])
        .filter((entry) => entry.required)
        .map((entry) => {
          const relation = entry.equipment as unknown as {
            name: string;
          } | null;
          return relation?.name;
        })
        .filter((value): value is string => Boolean(value));
      return {
        id: exercise.id,
        slug: exercise.slug,
        name: exercise.name_pt,
        movementPattern: exercise.movement_pattern,
        difficulty: exercise.difficulty,
        primaryMuscles: exercise.primary_muscles,
        secondaryMuscles: exercise.secondary_muscles,
        instructions: exercise.execution_instructions,
        breathing: exercise.breathing_instruction,
        errors: exercise.common_errors,
        equipment,
        mediaReady: readiness?.media_ready ?? false,
        autoPlanEligible: readiness?.auto_plan_eligible ?? false,
        mediaUrl: motion.data?.signedUrl ?? null,
        posterUrl: poster.data?.signedUrl ?? null,
        mediaType: (media?.media_type as "gif" | "video" | undefined) ?? null,
        mediaSource: media
          ? {
              author: media.author,
              sourceName: media.source_name,
              licenseCode: media.license_code,
              licenseUrl: media.license_url,
              sourceUrl: media.source_url,
              attributionText: media.attribution_text,
            }
          : null,
      } satisfies ExerciseLibraryItem;
    }),
  );

  return (
    <div>
      <p className="text-sm text-accent">Biblioteca</p>
      <h1 className="mt-1 text-3xl font-semibold">Exercícios</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Explore os movimentos disponíveis. O selo verde indica exercícios que
        podem entrar no seu plano atual considerando mídia e equipamentos.
      </p>
      <ExerciseLibrary items={items} />
    </div>
  );
}
