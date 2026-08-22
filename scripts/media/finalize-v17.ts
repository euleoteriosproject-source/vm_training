import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { primaryChecklistKeys } from "../../lib/media/operations.ts";
import {
  getAdminClient,
  isLocalSupabaseUrl,
  log,
  parseArgs,
} from "./shared.ts";

type Decision = {
  exerciseSlug: string;
  contentHash: string;
  decision: "APPROVE_PRIMARY" | "KEEP_PROCESSED";
  reviewNotes: string;
  references: string[];
};

type Validation = {
  version: string;
  checklist: Record<string, boolean>;
  entries: Decision[];
};

type RemoteMedia = {
  id: string;
  status: string;
  storage_path: string | null;
  poster_path: string | null;
  content_hash: string | null;
  license_code: string | null;
  license_url: string | null;
  author: string | null;
  attribution_text: string | null;
  attribution_required: boolean;
  media_role: string | null;
  execution_quality: string;
  exercise: { slug: string } | { slug: string }[] | null;
};

const args = parseArgs();
const validation = JSON.parse(
  await readFile("data/media/media-final-validation-v17.json", "utf8"),
) as Validation;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isLocal = isLocalSupabaseUrl(url);

if (validation.version !== "1.7" || validation.entries.length !== 7)
  throw new Error("A validação final v1.7 deve conter exatamente 7 decisões");
if (primaryChecklistKeys.some((key) => validation.checklist[key] !== true))
  throw new Error("Checklist PRIMARY incompleto");
if (args.apply && !isLocal && !args.allowProduction)
  throw new Error("Production exige --allow-production após dry-run revisado");

const client = getAdminClient()!;
const { data: admin, error: adminError } = await client
  .from("profiles")
  .select("user_id")
  .eq("role", "admin")
  .single();
if (adminError || !admin)
  throw adminError ?? new Error("Administrador real não encontrado");

const hashes = validation.entries.map((entry) => entry.contentHash);
const { data, error } = await client
  .from("exercise_media")
  .select(
    "id,status,storage_path,poster_path,content_hash,license_code,license_url,author,attribution_text,attribution_required,media_role,execution_quality,exercise:exercises!inner(slug)",
  )
  .in("content_hash", hashes);
if (error) throw error;
const mediaRows = (data ?? []) as unknown as RemoteMedia[];
if (mediaRows.length !== validation.entries.length)
  throw new Error(
    `Esperadas 7 mídias por hash; encontradas ${mediaRows.length}`,
  );

function exerciseSlug(media: RemoteMedia) {
  const relation = media.exercise;
  return Array.isArray(relation) ? relation[0]?.slug : relation?.slug;
}

for (const decision of validation.entries) {
  const media = mediaRows.find(
    (row) =>
      row.content_hash === decision.contentHash &&
      exerciseSlug(row) === decision.exerciseSlug,
  );
  if (!media) throw new Error(`${decision.exerciseSlug}: hash não corresponde`);
  if (media.status !== "processed")
    throw new Error(`${decision.exerciseSlug}: status esperado processed`);
  if (!media.storage_path || !media.poster_path)
    throw new Error(`${decision.exerciseSlug}: artefato ou poster ausente`);
  if (!media.license_code || !media.author || !media.attribution_text)
    throw new Error(`${decision.exerciseSlug}: provenance/licença incompleta`);
  if (media.attribution_required && !media.license_url)
    throw new Error(
      `${decision.exerciseSlug}: URL de licença obrigatória ausente`,
    );

  const [{ data: artifact, error: artifactError }, { error: posterError }] =
    await Promise.all([
      client.storage.from("exercise-media").download(media.storage_path),
      client.storage.from("exercise-media").download(media.poster_path),
    ]);
  if (artifactError || !artifact)
    throw artifactError ?? new Error(`${decision.exerciseSlug}: GIF ausente`);
  if (posterError) throw posterError;
  const remoteHash = createHash("sha256")
    .update(Buffer.from(await artifact.arrayBuffer()))
    .digest("hex");
  if (remoteHash !== decision.contentHash)
    throw new Error(`${decision.exerciseSlug}: hash remoto divergente`);

  log(
    "VALIDATED",
    `${decision.exerciseSlug}: ${decision.decision}; hash, poster e licença OK`,
  );
}

if (!args.apply) {
  log("DRY-RUN", "7/7 validadas; 6 PRIMARY; 1 permanece processed");
  process.exit(0);
}

for (const decision of validation.entries) {
  if (decision.decision !== "APPROVE_PRIMARY") continue;
  const media = mediaRows.find(
    (row) => row.content_hash === decision.contentHash,
  )!;
  const now = new Date().toISOString();
  const attribution =
    decision.exerciseSlug === "goblet-squat" &&
    !media.attribution_text?.includes("convertida e recortada")
      ? `${media.attribution_text} Versão convertida e recortada em GIF pelo VM Training.`
      : media.attribution_text;
  const { error: reviewError } = await client
    .from("exercise_media")
    .update({
      media_role: "PRIMARY_DEMO",
      execution_quality: "approved",
      review_checklist: validation.checklist,
      review_notes: decision.reviewNotes,
      reviewed_by: admin.user_id,
      reviewed_at: now,
      verified_by: admin.user_id,
      verified_at: now,
      attribution_text: attribution,
      rejection_reason: null,
    })
    .eq("id", media.id)
    .eq("status", "processed");
  if (reviewError) throw reviewError;
  const { error: eventError } = await client
    .from("media_review_events")
    .insert({
      media_id: media.id,
      admin_user_id: admin.user_id,
      action: "classified_primary",
      from_status: "processed",
      to_status: "processed",
      notes: decision.reviewNotes,
    });
  if (eventError) throw eventError;
  const { error: publishError } = await client.rpc("publish_exercise_media", {
    p_media_id: media.id,
    p_admin_id: admin.user_id,
  });
  if (publishError) throw publishError;
  log("PUBLISHED", `${decision.exerciseSlug}: PRIMARY_DEMO`);
}

const { data: finalRows, error: finalError } = await client
  .from("exercise_media")
  .select("status,media_role,is_primary,content_hash")
  .in("content_hash", hashes);
if (finalError) throw finalError;
const approved = (finalRows ?? []).filter(
  (row) =>
    row.status === "approved" &&
    row.media_role === "PRIMARY_DEMO" &&
    row.is_primary,
);
const kept = (finalRows ?? []).filter(
  (row) =>
    row.content_hash ===
      validation.entries.find((entry) => entry.exerciseSlug === "bike")
        ?.contentHash && row.status === "processed",
);
if (approved.length !== 6 || kept.length !== 1)
  throw new Error(
    `Pós-condição inválida: PRIMARY=${approved.length}; processed=${kept.length}`,
  );
log("APPLIED", "6 PRIMARY aprovadas; bike preservada como processed");
