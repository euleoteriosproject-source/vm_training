import {
  MediaReview,
  type ReviewCandidate,
} from "@/components/admin/media-review";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getExercisePublishReadiness } from "@/lib/media/operations";
import { redirect } from "next/navigation";
export default async function MediaReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ media?: string; exercise?: string }>;
}) {
  const params = await searchParams;
  const sessionClient = await createClient();
  const { data: auth } = await sessionClient.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: currentProfile } = await sessionClient
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();
  if (currentProfile?.role !== "admin") redirect("/today");
  const supabase = createAdminClient();
  const [
    { data: media },
    { data: exercises },
    { data: plans },
    { data: profiles },
  ] = await Promise.all([
    supabase
      .from("exercise_media")
      .select(
        "id,status,storage_path,source_name,source_url,original_file_url,license_code,license_url,author,attribution_text,match_score,match_details,candidate_metadata,width,height,duration_seconds,quality_score,media_role,execution_quality,processing_error,exercise:exercises(id,name_pt,slug,movement_pattern,primary_muscles,exercise_equipment(equipment(name)))",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("exercises")
      .select(
        "id,name_pt,active,movement_pattern,primary_muscles,execution_instructions,exercise_equipment(equipment_id),exercise_media(status,media_role,execution_quality,is_primary)",
      )
      .order("name_pt"),
    supabase
      .from("workout_plans")
      .select("user_id,status,workout_days(workout_day_exercises(exercise_id))")
      .in("status", ["active", "draft"]),
    supabase.from("profiles").select("user_id,email,display_name"),
  ]);
  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.user_id, profile]),
  );
  const neededBy = new Map<string, Set<string>>();
  for (const plan of plans ?? []) {
    const profile = profileById.get(plan.user_id);
    const owner =
      profile?.email === "vinicius.euleoterio@hotmail.com"
        ? "VINICIUS"
        : profile?.email === "lisepaiva@hotmail.com"
          ? "MARLISE"
          : (profile?.display_name?.toUpperCase() ?? "OUTRO PLANO");
    for (const day of plan.workout_days ?? [])
      for (const item of day.workout_day_exercises ?? []) {
        const owners = neededBy.get(item.exercise_id) ?? new Set<string>();
        owners.add(owner);
        neededBy.set(item.exercise_id, owners);
      }
  }
  const readinessById = new Map(
    (exercises ?? []).map((exercise) => {
      const readiness = getExercisePublishReadiness({
        active: exercise.active,
        approvedPrimaryMedia: (exercise.exercise_media ?? []).some(
          (entry) =>
            entry.status === "approved" &&
            entry.media_role === "PRIMARY_DEMO" &&
            entry.execution_quality === "approved" &&
            entry.is_primary,
        ),
        instructions: exercise.execution_instructions,
        equipmentCount: exercise.exercise_equipment?.length ?? 0,
        movementPattern: exercise.movement_pattern,
        primaryMuscles: exercise.primary_muscles,
      });
      return [exercise.id, readiness] as const;
    }),
  );
  const candidates: ReviewCandidate[] = await Promise.all(
    (media ?? []).map(async (item) => {
      let finalVideoUrl: string | null = null;
      if (item.storage_path) {
        const { data } = await supabase.storage
          .from("exercise-media")
          .createSignedUrl(item.storage_path, 3600);
        finalVideoUrl = data?.signedUrl ?? null;
      }
      const exercise = item.exercise as unknown as {
        id: string;
        name_pt: string;
        slug: string;
        movement_pattern: string;
        primary_muscles: string[];
        exercise_equipment: {
          equipment: { name: string } | { name: string }[] | null;
        }[];
      } | null;
      const metadata = item.candidate_metadata as {
        title?: string;
        description?: string;
      } | null;
      return {
        id: item.id,
        status: item.status,
        sourceName: item.source_name,
        sourceUrl: item.source_url,
        originalFileUrl: item.original_file_url,
        licenseCode: item.license_code,
        licenseUrl: item.license_url,
        author: item.author,
        attributionText: item.attribution_text,
        matchScore: item.match_score,
        matchDetails: (item.match_details ?? {}) as Record<
          string,
          boolean | number | string | string[]
        >,
        description: metadata?.description ?? "",
        title: metadata?.title ?? "",
        sourceVideoUrl: item.original_file_url,
        finalVideoUrl,
        width: item.width,
        height: item.height,
        duration: item.duration_seconds ? Number(item.duration_seconds) : null,
        qualityScore: item.quality_score,
        mediaRole: item.media_role as ReviewCandidate["mediaRole"],
        executionQuality: item.execution_quality,
        processingError: item.processing_error,
        exercise: {
          id: exercise?.id ?? "",
          name: exercise?.name_pt ?? "Exercício",
          slug: exercise?.slug ?? "",
          movement: exercise?.movement_pattern ?? "",
          muscles: exercise?.primary_muscles ?? [],
          equipment: (exercise?.exercise_equipment ?? []).flatMap((entry) => {
            const relation = entry.equipment;
            return Array.isArray(relation)
              ? relation.map((value) => value.name)
              : relation
                ? [relation.name]
                : [];
          }),
          neededByPlan: exercise ? neededBy.has(exercise.id) : false,
          neededBy: exercise ? [...(neededBy.get(exercise.id) ?? [])] : [],
          readiness: exercise ? (readinessById.get(exercise.id) ?? null) : null,
        },
      };
    }),
  );
  const total = exercises?.length ?? 0,
    published = (exercises ?? []).filter((item) =>
      item.exercise_media?.some(
        (entry) =>
          entry.status === "approved" &&
          entry.media_role === "PRIMARY_DEMO" &&
          entry.execution_quality === "approved" &&
          entry.is_primary,
      ),
    ).length,
    pending = (media ?? []).filter((item) =>
      ["pending", "reviewing", "processing", "processed", "failed"].includes(
        item.status,
      ),
    ).length,
    rejected = (media ?? []).filter(
      (item) => item.status === "rejected",
    ).length,
    coveredOrPending = (exercises ?? []).filter((item) =>
      item.exercise_media?.some((entry) =>
        [
          "approved",
          "pending",
          "reviewing",
          "processing",
          "processed",
          "failed",
        ].includes(entry.status),
      ),
    ).length;
  return (
    <div>
      <p className="text-sm text-accent">Administração</p>
      <h1 className="mt-1 text-3xl font-semibold">Biblioteca de exercícios</h1>
      <p className="mt-2 text-muted">
        Candidatos exigem validação legal e técnica antes da publicação.
      </p>
      <div className="mt-7">
        <MediaReview
          candidates={candidates}
          exercises={(exercises ?? []).map((item) => ({
            id: item.id,
            name: item.name_pt,
            hasMedia: item.exercise_media?.some((entry) =>
              [
                "approved",
                "pending",
                "reviewing",
                "processing",
                "processed",
                "failed",
              ].includes(entry.status),
            ),
            neededByPlan: neededBy.has(item.id),
            neededBy: [...(neededBy.get(item.id) ?? [])],
          }))}
          counts={{
            total,
            published,
            pending,
            missing: total - coveredOrPending,
            rejected,
          }}
          initialMedia={params.media}
          initialExercise={params.exercise}
        />
      </div>
    </div>
  );
}
