import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import {
  prepareLocalArtifact,
  prepareLocalFile,
} from "../../lib/media/prepare.ts";
import { generateContactSheet } from "../../lib/media/ffmpeg.ts";
import { mediaStoragePaths } from "../../lib/media/operations.ts";
import {
  getAdminClient,
  isLocalSupabaseUrl,
  log,
  parseArgs,
} from "./shared.ts";

const trims: Record<string, [number, number]> = {
  "leg-press": [34, 41],
  "goblet-squat": [3, 15],
  "leg-extension": [29, 35],
  "seated-leg-curl": [23, 31],
  "machine-row": [13, 22],
  "machine-chest-press": [15, 24],
  bike: [0, 9],
};
const args = parseArgs();
const confirmVisual = process.argv.includes("--confirm-visual");
const validation = JSON.parse(
  await readFile("data/media/media-validation-v15.json", "utf8"),
) as {
  candidates: Array<{
    candidateId: string;
    exerciseSlug: string;
    sourceTitle: string;
    sourceUrl: string;
    originalFileUrl: string;
    decision: string;
    recommendedRole: string;
    validationScore: number;
    license: {
      code: string;
      url: string;
      author: string;
      attributionRequired: boolean;
      attributionText: string;
      verified: boolean;
    };
  }>;
};
const inventory = JSON.parse(
  await readFile(".tmp/media-validation/inventory.json", "utf8"),
) as {
  candidates: Array<{
    candidateId: string;
    originalPath: string;
  }>;
};
const selected = validation.candidates.filter(
  (candidate) => candidate.decision === "APPROVE",
);
if (selected.length !== 7)
  throw new Error(
    `O lote GIF-first deve conter exatamente 7 candidatos; recebeu ${selected.length}`,
  );
if (selected.some((candidate) => candidate.decision !== "APPROVE"))
  throw new Error("Um candidato não aprovado entrou no lote de processamento");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isLocal = isLocalSupabaseUrl(url);
if (args.apply && !isLocal && !args.allowProduction)
  throw new Error(
    "Aplicação em Production exige --allow-production após dry-run revisado",
  );

const outputRoot = path.resolve(".tmp", "media-processing", "v16");
await mkdir(outputRoot, { recursive: true });
const results = [];
for (const candidate of selected) {
  const source = inventory.candidates.find(
    (item) => item.candidateId === candidate.candidateId,
  );
  if (!source)
    throw new Error(`Original ausente para ${candidate.candidateId}`);
  const trim = trims[candidate.exerciseSlug];
  if (!trim) throw new Error(`Corte ausente para ${candidate.exerciseSlug}`);
  const outputDirectory = path.join(outputRoot, candidate.exerciseSlug);
  const artifact = await prepareLocalArtifact({
    exerciseSlug: candidate.exerciseSlug,
    inputPath: source.originalPath,
    outputDirectory,
    trimStart: trim[0],
    trimEnd: trim[1],
    mediaRole: "PRIMARY_DEMO",
  });
  await generateContactSheet(
    artifact.mediaPath,
    path.join(outputDirectory, "review.webp"),
    artifact.metadata.durationSeconds,
  );
  const storage = mediaStoragePaths({
    exerciseSlug: candidate.exerciseSlug,
    role: "PRIMARY_DEMO",
    hash: artifact.hash,
    mediaType: artifact.mediaType,
  });
  await copyFile(
    artifact.mediaPath,
    path.join(
      outputDirectory,
      `final.${artifact.mediaType === "gif" ? "gif" : "mp4"}`,
    ),
  );
  const mediaStats = await stat(artifact.mediaPath);
  results.push({
    candidateId: candidate.candidateId,
    exerciseSlug: candidate.exerciseSlug,
    sourceTitle: candidate.sourceTitle,
    sourceUrl: candidate.sourceUrl,
    originalFileUrl: candidate.originalFileUrl,
    mediaRole: "PRIMARY_DEMO",
    trimStart: trim[0],
    trimEnd: trim[1],
    mediaType: artifact.mediaType,
    fallbackReason: artifact.fallbackReason,
    storagePath: storage.mediaPath,
    posterPath: storage.posterPath,
    contentHash: artifact.hash,
    width: artifact.metadata.width,
    height: artifact.metadata.height,
    durationSeconds: artifact.metadata.durationSeconds,
    fileSizeBytes: mediaStats.size,
    frameCount: artifact.frameCount,
    framesPerSecond: artifact.framesPerSecond,
    loop: artifact.animationLoop,
    animated: artifact.mediaType === "video" || artifact.frameCount > 1,
    visualReview: {
      approved: confirmVisual,
      question:
        "Um iniciante entende o movimento correto sem explicação adicional?",
      answer: confirmVisual ? "Sim" : "Pendente",
    },
    validationScore: candidate.validationScore,
    license: candidate.license,
    status: args.apply ? "approved" : "processed_dry_run",
  });
  log(
    "GIF-FIRST",
    `${candidate.exerciseSlug}: ${artifact.mediaType} ${(mediaStats.size / 1024 / 1024).toFixed(2)} MB`,
  );
}

if (args.apply) {
  if (!confirmVisual)
    throw new Error(
      "Use --confirm-visual somente após revisar visualmente os 7 artefatos finais",
    );
  const client = getAdminClient()!;
  const { data: existingAdmin, error: adminError } = await client
    .from("profiles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  let admin = existingAdmin;
  if (adminError) throw adminError;
  if (!admin && isLocal) {
    const { data: invitation, error: invitationError } = await client
      .from("allowed_signup_emails")
      .select("email")
      .eq("default_role", "admin")
      .eq("active", true)
      .limit(1)
      .single();
    if (invitationError) throw invitationError;
    const { data: created, error: createError } =
      await client.auth.admin.createUser({
        email: invitation.email,
        password: randomBytes(32).toString("base64url"),
        email_confirm: true,
      });
    if (createError) throw createError;
    admin = { user_id: created.user.id };
  }
  if (!admin) throw new Error("Administrador não encontrado");
  for (const result of results) {
    const source = inventory.candidates.find(
      (item) => item.candidateId === result.candidateId,
    )!;
    const { data: exercise, error: exerciseError } = await client
      .from("exercises")
      .select("id")
      .eq("slug", result.exerciseSlug)
      .single();
    if (exerciseError) throw exerciseError;
    const { error: reviewMetadataError } = await client
      .from("exercise_media")
      .update({
        reviewed_by: admin.user_id,
        reviewed_at: new Date().toISOString(),
        verified_by: admin.user_id,
        verified_at: new Date().toISOString(),
      })
      .eq("exercise_id", exercise.id)
      .eq("source_url", result.sourceUrl);
    if (reviewMetadataError) throw reviewMetadataError;
    const { data: row, error } = await client
      .from("exercise_media")
      .select("id,status,ready_for_processing")
      .eq("exercise_id", exercise.id)
      .eq("source_url", result.sourceUrl)
      .single();
    if (error) throw error;
    if (
      !["reviewing", "failed", "processed"].includes(row.status) ||
      (row.status !== "processed" && !row.ready_for_processing)
    )
      throw new Error(
        `${result.exerciseSlug} não está pronto para processamento`,
      );
    if (row.status === "processed") {
      const { error: publishError } = await client.rpc(
        "publish_exercise_media",
        {
          p_media_id: row.id,
          p_admin_id: admin.user_id,
        },
      );
      if (publishError) throw publishError;
      continue;
    }
    const startedAt = new Date().toISOString();
    const { error: startError } = await client
      .from("exercise_media")
      .update({
        status: "processing",
        processing_started_at: startedAt,
        processing_error: null,
      })
      .eq("id", row.id);
    if (startError) throw startError;
    const prepared = await prepareLocalFile(client, {
      id: row.id,
      exerciseSlug: result.exerciseSlug,
      inputPath: source.originalPath,
      trimStart: result.trimStart,
      trimEnd: result.trimEnd,
      mediaRole: "PRIMARY_DEMO",
    });
    const { error: updateError } = await client
      .from("exercise_media")
      .update({
        ...prepared,
        processing_log: [{ at: startedAt, event: "gif_first_processed" }],
      })
      .eq("id", row.id);
    if (updateError) throw updateError;
    const { error: publishError } = await client.rpc("publish_exercise_media", {
      p_media_id: row.id,
      p_admin_id: admin.user_id,
    });
    if (publishError) throw publishError;
  }
}

const generatedAt = new Date().toISOString();
await mkdir("data/media", { recursive: true });
await writeFile(
  "data/media/media-processing-v16.json",
  `${JSON.stringify({ version: "1.6", strategy: "GIF-FIRST", generatedAt, target: isLocal ? "local" : "production", applied: args.apply, summary: { selected: 7, processed: results.length, gifs: results.filter((item) => item.mediaType === "gif").length, videoFallbacks: results.filter((item) => item.mediaType === "video").length, rejectedProcessed: 0 }, results }, null, 2)}\n`,
);
await writeFile(
  "data/media/primary-media-manifest.json",
  `${JSON.stringify({ version: "1.6", strategy: "GIF-FIRST", generatedAt, entries: results.map(({ candidateId, exerciseSlug, mediaRole, mediaType, fallbackReason, storagePath, posterPath, contentHash, width, height, durationSeconds, fileSizeBytes, frameCount, framesPerSecond, loop, animated, visualReview, license }) => ({ candidateId, exerciseSlug, mediaRole, mediaType, fallbackReason, storagePath, posterPath, contentHash, width, height, durationSeconds, fileSizeBytes, frameCount, framesPerSecond, loop, animated, visualReview, license })) }, null, 2)}\n`,
);
log(
  args.apply ? "APPLIED" : "DRY-RUN",
  `${results.length} mídias; rejeitadas processadas: 0`,
);
