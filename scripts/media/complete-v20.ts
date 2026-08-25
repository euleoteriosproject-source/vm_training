import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  prepareLocalArtifact,
  prepareLocalFile,
} from "../../lib/media/prepare.ts";
import { sha256File } from "../../lib/media/hash.ts";
import { getAdminClient, log, parseArgs } from "./shared.ts";

const DATASET_PATH = "data/media/media-v20.json";
const ALLOWED_SOURCE_HOSTS = new Set([
  "upload.wikimedia.org",
  "d34w7g4gy10iej.cloudfront.net",
]);
const checklist = {
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
};
const automatedChecks = {
  exercise_match_exact: true,
  equipment_match: true,
  execution_quality_approved: true,
  visibility_sufficient: true,
  license_verified: true,
  download_permitted: true,
  transformation_permitted: true,
  rehost_permitted: true,
  source_provenance_verified: true,
  visual_inspection_passed: true,
  biomechanical_references_passed: true,
  final_gif_inspection_passed: true,
};

type Decision = {
  exercise: string;
  sourceFile: string;
  title: string;
  sourceName: string;
  sourceType: "creative_commons" | "public_domain";
  sourceUrl: string;
  originalFileUrl: string;
  licenseCode: string;
  licenseUrl: string;
  author: string;
  attributionRequired: boolean;
  attributionText: string;
  licenseEvidence?: string;
  trimStart: number;
  trimEnd: number;
  posterTimestamp: number;
  sourceSha256: string;
  artifactSha256: string;
  posterSha256: string;
  mediaType: "gif" | "video";
  fallbackReason: string | null;
  references: string[];
  reason: string;
};
type Dataset = {
  version: string;
  projectRef: string;
  reviewAgent: string;
  decisions: Decision[];
};

function hashBytes(bytes: ArrayBuffer) {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

async function ensureSource(decision: Decision) {
  const sourcePath = path.resolve(decision.sourceFile);
  try {
    if ((await sha256File(sourcePath)) === decision.sourceSha256)
      return sourcePath;
    throw new Error(`${decision.exercise}: fonte local com hash divergente`);
  } catch (error) {
    if (error instanceof Error && !/ENOENT/.test(error.message)) throw error;
  }

  const sourceUrl = new URL(decision.originalFileUrl);
  if (
    sourceUrl.protocol !== "https:" ||
    !ALLOWED_SOURCE_HOSTS.has(sourceUrl.hostname)
  )
    throw new Error(`${decision.exercise}: host de origem nao permitido`);
  const response = await fetch(sourceUrl, { redirect: "follow" });
  if (!response.ok)
    throw new Error(`${decision.exercise}: download HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, bytes);
  if ((await sha256File(sourcePath)) !== decision.sourceSha256)
    throw new Error(`${decision.exercise}: hash da fonte baixada diverge`);
  return sourcePath;
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
    throw error ?? new Error(`Storage ausente: ${objectPath}`);
  const hash = hashBytes(await data.arrayBuffer());
  if (hash !== expectedHash)
    throw new Error(`Hash remoto divergente: ${objectPath}`);
}

const args = parseArgs();
const confirmVisual = process.argv.includes("--confirm-visual");
const dataset = JSON.parse(await readFile(DATASET_PATH, "utf8")) as Dataset;
if (
  dataset.version !== "2.0" ||
  dataset.projectRef !== "inghftngeritrsezwxnm" ||
  dataset.reviewAgent !== "vm-media-validator-v20" ||
  dataset.decisions.length !== 3
)
  throw new Error("Dataset v2.0 invalido");

const prepared = new Map<
  string,
  Awaited<ReturnType<typeof prepareLocalArtifact>> & { sourcePath: string }
>();
for (const decision of dataset.decisions) {
  const sourcePath = await ensureSource(decision);
  const artifact = await prepareLocalArtifact({
    exerciseSlug: decision.exercise,
    inputPath: sourcePath,
    outputDirectory: path.resolve(".tmp/media-v20/prepared", decision.exercise),
    trimStart: decision.trimStart,
    trimEnd: decision.trimEnd,
    mediaRole: "PRIMARY_DEMO",
    posterTimestamp: decision.posterTimestamp,
  });
  const posterHash = await sha256File(artifact.posterPath);
  if (
    artifact.hash !== decision.artifactSha256 ||
    posterHash !== decision.posterSha256 ||
    artifact.mediaType !== decision.mediaType ||
    artifact.fallbackReason !== decision.fallbackReason ||
    artifact.frameCount <= 1 ||
    !artifact.animationLoop
  )
    throw new Error(`${decision.exercise}: artefato diverge da revisao v2.0`);
  prepared.set(decision.exercise, { ...artifact, sourcePath });
  log(
    "DRY-RUN",
    `${decision.exercise}: ${artifact.mediaType.toUpperCase()} ${artifact.metadata.width}x${artifact.metadata.height}, ${artifact.metadata.durationSeconds}s, ${artifact.frameCount} frames`,
  );
}

if (!args.apply) {
  log("DRY-RUN", "3/3 artefatos reproduzidos; zero writes remotos");
  process.exit(0);
}
if (!args.allowProduction || !confirmVisual)
  throw new Error("Production exige --allow-production --confirm-visual");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || new URL(url).hostname.split(".")[0] !== dataset.projectRef)
  throw new Error("Projeto Supabase diverge do dataset v2.0");

const client = getAdminClient()!;
const licenseCodes = [
  ...new Set(dataset.decisions.map((decision) => decision.licenseCode)),
];
const { data: licenses, error: licensesError } = await client
  .from("media_licenses")
  .select("code,active")
  .in("code", licenseCodes);
if (licensesError) throw licensesError;
const activeLicenseCodes = new Set(
  (licenses ?? [])
    .filter((license) => license.active)
    .map((license) => license.code),
);
const missingLicenseCodes = licenseCodes.filter(
  (code) => !activeLicenseCodes.has(code),
);
if (missingLicenseCodes.length > 0)
  throw new Error(
    `Licencas ausentes ou inativas: ${missingLicenseCodes.join(", ")}`,
  );

for (const decision of dataset.decisions) {
  const artifact = prepared.get(decision.exercise)!;
  const { data: exercise, error: exerciseError } = await client
    .from("exercises")
    .select("id,slug,active")
    .eq("slug", decision.exercise)
    .single();
  if (exerciseError || !exercise)
    throw exerciseError ?? new Error("Exercicio ausente");

  const { data: current, error: currentError } = await client
    .from("exercise_media")
    .select("id,status,storage_path,poster_path,content_hash,is_primary")
    .eq("exercise_id", exercise.id)
    .eq("source_url", decision.sourceUrl)
    .maybeSingle();
  if (currentError) throw currentError;
  if (current?.status === "approved") {
    if (current.content_hash !== decision.artifactSha256 || !current.is_primary)
      throw new Error(
        `${decision.exercise}: PRIMARY existente diverge do dataset`,
      );
    await Promise.all([
      verifyRemoteObject(
        client,
        current.storage_path!,
        decision.artifactSha256,
      ),
      verifyRemoteObject(client, current.poster_path!, decision.posterSha256),
    ]);
    log("IDEMPOTENT", `${decision.exercise}: ja publicado e verificado`);
    continue;
  }
  if (current?.status === "processed") {
    if (current.content_hash !== decision.artifactSha256)
      throw new Error(`${decision.exercise}: processed com hash divergente`);
    await Promise.all([
      verifyRemoteObject(
        client,
        current.storage_path!,
        decision.artifactSha256,
      ),
      verifyRemoteObject(client, current.poster_path!, decision.posterSha256),
    ]);
    log("IDEMPOTENT", `${decision.exercise}: ja processado e verificado`);
    continue;
  }

  let mediaId = current?.id as string | undefined;
  let status = current?.status as string | undefined;
  if (!mediaId) {
    const sourceSize = (await stat(artifact.sourcePath)).size;
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
        source_name: decision.sourceName,
        source_type: decision.sourceType,
        source_url: decision.sourceUrl,
        original_file_url: decision.originalFileUrl,
        license_code: decision.licenseCode,
        license_url: decision.licenseUrl,
        author: decision.author,
        attribution_required: decision.attributionRequired,
        attribution_text: decision.attributionText,
        file_size_bytes: sourceSize,
        match_score: 100,
        match_details: { semantic_match: "EXACT", equipment_match: true },
        candidate_metadata: {
          title: decision.title,
          validation_version: dataset.version,
          references: decision.references,
          license_evidence: decision.licenseEvidence ?? decision.sourceUrl,
        },
      })
      .select("id")
      .single();
    if (error || !inserted)
      throw error ?? new Error("Falha ao inserir candidato");
    mediaId = inserted.id;
    status = "pending";
    const { error: eventError } = await client
      .from("media_review_events")
      .insert({
        media_id: mediaId,
        admin_user_id: null,
        action: "discovered",
        from_status: null,
        to_status: "pending",
        metadata: {
          review_method: "automated",
          review_agent: dataset.reviewAgent,
        },
      });
    if (eventError) throw eventError;
  }

  const reviewedAt = new Date().toISOString();
  const reviewingStatus =
    status === "pending" || status === "rejected" ? "reviewing" : status;
  const checksBeforeStorage = {
    ...automatedChecks,
    storage_hash_verified: false,
  };
  const { error: reviewError } = await client
    .from("exercise_media")
    .update({
      status: reviewingStatus,
      review_state: "AUTOMATED_VALIDATED",
      review_method: "automated",
      review_agent: dataset.reviewAgent,
      reviewed_by: null,
      reviewed_at: reviewedAt,
      verified_by: null,
      verified_at: reviewedAt,
      validation_version: dataset.version,
      validation_confidence: "HIGH",
      automated_validation: checksBeforeStorage,
      media_role: "PRIMARY_DEMO",
      execution_quality: "approved",
      review_checklist: checklist,
      review_notes: decision.reason,
      trim_start: decision.trimStart,
      trim_end: decision.trimEnd,
      poster_timestamp: decision.posterTimestamp,
      ready_for_processing: true,
      rejection_reason: null,
    })
    .eq("id", mediaId);
  if (reviewError) throw reviewError;
  status = reviewingStatus;
  const { error: reviewEventError } = await client
    .from("media_review_events")
    .insert({
      media_id: mediaId,
      admin_user_id: null,
      action: "automated_validated",
      from_status: current?.status ?? "pending",
      to_status: status,
      notes: decision.reason,
      metadata: {
        validation_version: dataset.version,
        review_method: "automated",
        review_agent: dataset.reviewAgent,
        references: decision.references,
        confidence: "HIGH",
        checks: checksBeforeStorage,
      },
    });
  if (reviewEventError) throw reviewEventError;

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
  try {
    const result = await prepareLocalFile(client, {
      id: mediaId,
      exerciseSlug: decision.exercise,
      inputPath: artifact.sourcePath,
      trimStart: decision.trimStart,
      trimEnd: decision.trimEnd,
      mediaRole: "PRIMARY_DEMO",
      posterTimestamp: decision.posterTimestamp,
      finalSourceUrl: decision.originalFileUrl,
      downloadedAt: reviewedAt,
    });
    await Promise.all([
      verifyRemoteObject(client, result.storage_path, decision.artifactSha256),
      verifyRemoteObject(client, result.poster_path, decision.posterSha256),
    ]);
    const { error: updateError } = await client
      .from("exercise_media")
      .update({
        ...result,
        automated_validation: {
          ...automatedChecks,
          storage_hash_verified: true,
        },
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
          validation_version: dataset.version,
          review_agent: dataset.reviewAgent,
          content_hash: decision.artifactSha256,
          poster_hash: decision.posterSha256,
        },
      });
    if (processedEventError) throw processedEventError;
    log(
      "PROCESSED",
      `${decision.exercise}: upload e hashes remotos verificados`,
    );
  } catch (error) {
    await client
      .from("exercise_media")
      .update({
        status: "failed",
        review_state: "AUTOMATED_VALIDATED",
        processing_error:
          error instanceof Error ? error.message : String(error),
      })
      .eq("id", mediaId);
    throw error;
  }
}
log(
  "NEXT",
  "3/3 processadas; publicar somente por migration automatizada revisada",
);
