import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  prepareLocalArtifact,
  prepareLocalFile,
} from "../../lib/media/prepare.ts";
import { sha256File } from "../../lib/media/hash.ts";
import { getAdminClient, log, parseArgs } from "./shared.ts";

const PROJECT_REF = "inghftngeritrsezwxnm";
const REVIEW_AGENT = "vm-media-validator-v181";
const VALIDATION_VERSION = "1.8.1";
const DATASET_PATH = "data/media/active-plan-media-v181.json";
const SOURCE_PATH = path.resolve(
  ".tmp/media-validation/original/machine-shoulder-press/46f41a7577ededd9.webm",
);

type AutomatedDecision = {
  exercise: string;
  decision: string;
  confidence: string;
  candidate: {
    title: string;
    sourceUrl: string;
    originalFileUrl: string;
    licenseCode: string;
    licenseUrl: string;
    author: string;
    attributionRequired: boolean;
    attributionText: string;
    trimStart: number;
    trimEnd: number;
    sourceSha256: string;
    gifSha256: string;
    posterSha256: string;
    checks: Record<string, boolean>;
  };
  references: Array<{ name: string; url: string }>;
  reason: string;
};

type Dataset = {
  projectRef: string;
  reviewAgent: string;
  decisions: AutomatedDecision[];
};

function hashBytes(bytes: ArrayBuffer) {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

async function verifyRemoteObject(
  client: NonNullable<ReturnType<typeof getAdminClient>>,
  objectPath: string,
  expectedHash: string,
) {
  const { data, error } = await client.storage
    .from("exercise-media")
    .download(objectPath);
  if (error || !data)
    throw new Error(
      `Falha ao verificar Storage: ${error?.message ?? objectPath}`,
    );
  const hash = hashBytes(await data.arrayBuffer());
  if (hash !== expectedHash)
    throw new Error(`Hash remoto divergente para ${objectPath}`);
  return hash;
}

const args = parseArgs();
const confirmVisual = process.argv.includes("--confirm-visual");
const dataset = JSON.parse(await readFile(DATASET_PATH, "utf8")) as Dataset;
const decision = dataset.decisions.find(
  (item) => item.exercise === "machine-shoulder-press",
);
if (!decision?.candidate) throw new Error("Decisao automatizada ausente");
if (
  dataset.projectRef !== PROJECT_REF ||
  dataset.reviewAgent !== REVIEW_AGENT ||
  decision.decision !== "AUTOMATED_VALIDATED" ||
  decision.confidence !== "HIGH" ||
  Object.entries(decision.candidate.checks).some(
    ([key, value]) => key !== "storage_hash_verified" && value !== true,
  )
)
  throw new Error("Dataset v1.8.1 nao satisfaz o gate automatizado");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || new URL(url).hostname.split(".")[0] !== PROJECT_REF)
  throw new Error("Projeto Supabase diverge de inghftngeritrsezwxnm");

const sourceHash = await sha256File(SOURCE_PATH);
if (sourceHash !== decision.candidate.sourceSha256)
  throw new Error("Hash da fonte local diverge do artefato revisado");

const preview = await prepareLocalArtifact({
  exerciseSlug: decision.exercise,
  inputPath: SOURCE_PATH,
  outputDirectory: path.resolve(".tmp/v181/machine-shoulder-press/dry-run"),
  trimStart: decision.candidate.trimStart,
  trimEnd: decision.candidate.trimEnd,
  mediaRole: "PRIMARY_DEMO",
});
const previewPosterHash = await sha256File(preview.posterPath);
if (
  preview.hash !== decision.candidate.gifSha256 ||
  previewPosterHash !== decision.candidate.posterSha256 ||
  preview.mediaType !== "gif" ||
  preview.frameCount <= 1 ||
  !preview.animationLoop ||
  preview.fallbackReason !== null
)
  throw new Error("Artefato GIF-first diverge da revisao final");

log(
  "DRY-RUN",
  `${decision.exercise}: GIF ${preview.metadata.width}x${preview.metadata.height}, ${preview.metadata.durationSeconds}s, ${preview.frameCount} frames`,
);
if (!args.apply) {
  log(
    "DRY-RUN",
    "Zero writes; use --apply --allow-production --confirm-visual",
  );
  process.exit(0);
}
if (!args.allowProduction || !confirmVisual)
  throw new Error(
    "Production exige --allow-production e --confirm-visual apos revisar o GIF final",
  );

const client = getAdminClient()!;
const { data: exercise, error: exerciseError } = await client
  .from("exercises")
  .select("id,slug,active")
  .eq("slug", decision.exercise)
  .single();
if (exerciseError || !exercise)
  throw exerciseError ?? new Error("Exercicio ausente");

const { data: existing, error: existingError } = await client
  .from("exercise_media")
  .select("id,status,storage_path,poster_path,content_hash")
  .eq("exercise_id", exercise.id)
  .eq("source_url", decision.candidate.sourceUrl)
  .maybeSingle();
if (existingError) throw existingError;
if (existing?.status === "approved") {
  if (existing.content_hash !== decision.candidate.gifSha256)
    throw new Error("Candidato ja publicado com hash divergente");
  log("IDEMPOTENT", `${decision.exercise}: ja publicado`);
  process.exit(0);
}

let mediaId = existing?.id as string | undefined;
if (!mediaId) {
  const { data: inserted, error } = await client
    .from("exercise_media")
    .insert({
      exercise_id: exercise.id,
      media_type: "video",
      storage_path: null,
      poster_path: null,
      status: "pending",
      review_state: "MANUAL_REVIEW_REQUIRED",
      media_role: null,
      angle: "main",
      source_name: "Wikimedia Commons",
      source_type: "public_domain",
      source_url: decision.candidate.sourceUrl,
      original_file_url: decision.candidate.originalFileUrl,
      license_code: decision.candidate.licenseCode,
      license_url: decision.candidate.licenseUrl,
      author: decision.candidate.author,
      attribution_required: decision.candidate.attributionRequired,
      attribution_text: decision.candidate.attributionText,
      file_size_bytes: 3502320,
      width: 320,
      height: 240,
      duration_seconds: 30.491,
      match_score: 73,
      match_details: { semantic_match: "EXACT", equipment_match: true },
      candidate_metadata: {
        title: decision.candidate.title,
        validation_version: VALIDATION_VERSION,
        references: decision.references,
      },
    })
    .select("id")
    .single();
  if (error || !inserted) throw error ?? new Error("Falha ao criar candidato");
  mediaId = inserted.id;
  const { error: eventError } = await client
    .from("media_review_events")
    .insert({
      media_id: mediaId,
      admin_user_id: null,
      action: "discovered",
      from_status: null,
      to_status: "pending",
      metadata: {
        validation_version: VALIDATION_VERSION,
        review_method: "automated",
        review_agent: REVIEW_AGENT,
        source: decision.candidate.sourceUrl,
        license: decision.candidate.licenseCode,
      },
    });
  if (eventError) throw eventError;
}

const reviewedAt = new Date().toISOString();
const checksBeforeStorage = {
  ...decision.candidate.checks,
  storage_hash_verified: false,
};
const { error: validationError } = await client
  .from("exercise_media")
  .update({
    status: "reviewing",
    review_state: "AUTOMATED_VALIDATED",
    review_method: "automated",
    review_agent: REVIEW_AGENT,
    reviewed_by: null,
    reviewed_at: reviewedAt,
    verified_by: null,
    verified_at: reviewedAt,
    validation_version: VALIDATION_VERSION,
    validation_confidence: "HIGH",
    automated_validation: checksBeforeStorage,
    media_role: "PRIMARY_DEMO",
    execution_quality: "approved",
    review_checklist: {
      correct_exercise: true,
      compatible_equipment: true,
      start_position_visible: true,
      main_range_visible: true,
      complete_repetition_visible: true,
      technically_acceptable: true,
      sufficient_clarity: true,
      useful_framing: true,
      no_blocking_elements: true,
      license_confirmed: true,
    },
    review_notes: decision.reason,
    trim_start: decision.candidate.trimStart,
    trim_end: decision.candidate.trimEnd,
    poster_timestamp: 2.8,
    ready_for_processing: true,
    rejection_reason: null,
  })
  .eq("id", mediaId);
if (validationError) throw validationError;
const { error: validatedEventError } = await client
  .from("media_review_events")
  .insert({
    media_id: mediaId,
    admin_user_id: null,
    action: "automated_validated",
    from_status: existing?.status ?? "pending",
    to_status: "reviewing",
    notes: decision.reason,
    metadata: {
      validation_version: VALIDATION_VERSION,
      review_method: "automated",
      review_agent: REVIEW_AGENT,
      references: decision.references,
      confidence: "HIGH",
      checks: checksBeforeStorage,
    },
  });
if (validatedEventError) throw validatedEventError;

const startedAt = new Date().toISOString();
const { error: processingError } = await client
  .from("exercise_media")
  .update({
    status: "processing",
    processing_started_at: startedAt,
    processing_error: null,
  })
  .eq("id", mediaId);
if (processingError) throw processingError;
await client.from("media_review_events").insert({
  media_id: mediaId,
  admin_user_id: null,
  action: "processing_started",
  from_status: "reviewing",
  to_status: "processing",
  metadata: {
    review_agent: REVIEW_AGENT,
    validation_version: VALIDATION_VERSION,
  },
});

let uploadedPaths: string[] = [];
try {
  const prepared = await prepareLocalFile(client, {
    id: mediaId,
    exerciseSlug: decision.exercise,
    inputPath: SOURCE_PATH,
    trimStart: decision.candidate.trimStart,
    trimEnd: decision.candidate.trimEnd,
    mediaRole: "PRIMARY_DEMO",
    posterTimestamp: 2.8,
    finalSourceUrl: decision.candidate.originalFileUrl,
    downloadedAt: reviewedAt,
  });
  uploadedPaths = [prepared.storage_path, prepared.poster_path];
  const [remoteGifHash, remotePosterHash] = await Promise.all([
    verifyRemoteObject(
      client,
      prepared.storage_path,
      decision.candidate.gifSha256,
    ),
    verifyRemoteObject(
      client,
      prepared.poster_path,
      decision.candidate.posterSha256,
    ),
  ]);
  const completedChecks = {
    ...decision.candidate.checks,
    storage_hash_verified: true,
  };
  const { error: updateError } = await client
    .from("exercise_media")
    .update({
      ...prepared,
      automated_validation: completedChecks,
      processing_log: [
        { at: startedAt, event: "processing_started" },
        { at: new Date().toISOString(), event: "processed" },
      ],
    })
    .eq("id", mediaId);
  if (updateError) throw updateError;
  const { error: processedEventError } = await client
    .from("media_review_events")
    .insert({
      media_id: mediaId,
      admin_user_id: null,
      action: "processed",
      from_status: "processing",
      to_status: "processed",
      metadata: {
        validation_version: VALIDATION_VERSION,
        review_method: "automated",
        review_agent: REVIEW_AGENT,
        confidence: "HIGH",
        content_hash: remoteGifHash,
        poster_hash: remotePosterHash,
      },
    });
  if (processedEventError) throw processedEventError;
  log("PROCESSED", `${decision.exercise}: upload e hashes remotos validados`);
  log(
    "NEXT",
    `publique ${mediaId} via private.publish_validated_exercise_media_automated`,
  );
} catch (error) {
  if (uploadedPaths.length)
    await client.storage.from("exercise-media").remove(uploadedPaths);
  await client
    .from("exercise_media")
    .update({
      status: "failed",
      review_state: "MANUAL_REVIEW_REQUIRED",
      processing_error: error instanceof Error ? error.message : String(error),
    })
    .eq("id", mediaId);
  throw error;
}
