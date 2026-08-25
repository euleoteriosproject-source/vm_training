import { createHash } from "node:crypto";
import { getAdminClient, log } from "./shared.ts";

type PrimaryMedia = {
  status: string;
  execution_quality: string;
  media_role: string | null;
  is_primary: boolean;
  media_type: string;
  frame_count: number | null;
  animation_verified: boolean;
  content_hash: string | null;
  storage_path: string | null;
  poster_path: string | null;
  source_name: string | null;
  source_url: string | null;
  original_file_url: string | null;
  license_code: string | null;
  license_url: string | null;
  attribution_text: string | null;
};

const client = getAdminClient()!;
const { data: plans, error: plansError } = await client
  .from("workout_plans")
  .select("workout_days(workout_day_exercises(exercise_id))")
  .eq("status", "active");
if (plansError) throw plansError;
const exerciseIds = [
  ...new Set(
    (plans ?? []).flatMap((plan) =>
      (plan.workout_days ?? []).flatMap((day) =>
        (day.workout_day_exercises ?? []).map((item) => item.exercise_id),
      ),
    ),
  ),
];
if (exerciseIds.length === 0)
  throw new Error("Nenhum exercício em plano ativo");

const { data: exercises, error: exercisesError } = await client
  .from("exercises")
  .select(
    "id,slug,exercise_media(status,execution_quality,media_role,is_primary,media_type,frame_count,animation_verified,content_hash,storage_path,poster_path,source_name,source_url,original_file_url,license_code,license_url,attribution_text)",
  )
  .in("id", exerciseIds)
  .order("slug");
if (exercisesError) throw exercisesError;
if (exercises?.length !== exerciseIds.length)
  throw new Error("Catálogo diverge dos exercícios do plano ativo");

for (const exercise of exercises) {
  const primary = (exercise.exercise_media as PrimaryMedia[]).filter(
    (media) =>
      media.status === "approved" &&
      media.execution_quality === "approved" &&
      media.media_role === "PRIMARY_DEMO" &&
      media.is_primary,
  );
  if (primary.length !== 1)
    throw new Error(`${exercise.slug}: PRIMARY_DEMO=${primary.length}`);
  const media = primary[0];
  if (
    !["gif", "video"].includes(media.media_type) ||
    !media.animation_verified ||
    (media.frame_count ?? 0) <= 1
  )
    throw new Error(`${exercise.slug}: PRIMARY não animada`);
  if (
    !media.storage_path ||
    !media.poster_path ||
    !media.content_hash ||
    !/^[a-f0-9]{64}$/.test(media.content_hash)
  )
    throw new Error(`${exercise.slug}: identidade de Storage incompleta`);
  if (
    !media.source_name ||
    !media.source_url ||
    !media.original_file_url ||
    !media.license_code ||
    !media.license_url ||
    !media.attribution_text
  )
    throw new Error(`${exercise.slug}: proveniência ou atribuição incompleta`);

  const [
    { data: artifact, error: artifactError },
    { data: poster, error: posterError },
  ] = await Promise.all([
    client.storage.from("exercise-media").download(media.storage_path),
    client.storage.from("exercise-media").download(media.poster_path),
  ]);
  if (artifactError || !artifact)
    throw artifactError ?? new Error(`${exercise.slug}: arquivo ausente`);
  if (posterError || !poster)
    throw posterError ?? new Error(`${exercise.slug}: poster ausente`);
  const remoteHash = createHash("sha256")
    .update(Buffer.from(await artifact.arrayBuffer()))
    .digest("hex");
  if (remoteHash !== media.content_hash)
    throw new Error(`${exercise.slug}: HASH_MISMATCH`);
  if (poster.size === 0) throw new Error(`${exercise.slug}: poster vazio`);
  log("PASS", `${exercise.slug}: ${media.media_type}; hash e poster válidos`);
}

log(
  "PASS",
  `${exerciseIds.length}/${exerciseIds.length} exercícios únicos de planos ativos com PRIMARY válida`,
);
