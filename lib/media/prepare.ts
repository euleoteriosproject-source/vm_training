import type { SupabaseClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { downloadMedia } from "./download.ts";
import {
  cleanupMediaWorkspace,
  createMediaWorkspace,
  generatePoster,
  inspectAnimatedGif,
  probeMedia,
  processGif,
  processVideo,
} from "./ffmpeg.ts";
import { sha256File } from "./hash.ts";
import {
  mediaStoragePaths,
  type GifFallbackReason,
  type MediaRole,
} from "./operations.ts";

const MAX_GIF_BYTES = 8 * 1024 * 1024;
function numericFrameRate(rate: string | null) {
  if (!rate) return 0;
  const [numerator = 0, denominator = 1] = rate.split("/").map(Number);
  return denominator ? Number((numerator / denominator).toFixed(2)) : 0;
}

export type PreparedCandidate = {
  id: string;
  original_file_url: string | null;
  trim_start: number | null;
  trim_end: number | null;
  media_role: MediaRole | null;
  poster_timestamp: number | null;
  exercise: { slug: string } | { slug: string }[] | null;
};
export async function prepareExternalCandidate(
  client: SupabaseClient,
  candidate: PreparedCandidate,
) {
  if (!candidate.original_file_url)
    throw new Error("Candidato sem URL original");
  const relation = Array.isArray(candidate.exercise)
    ? candidate.exercise[0]
    : candidate.exercise;
  if (!relation) throw new Error("Exercício do candidato não encontrado");
  if (!candidate.media_role)
    throw new Error("Classifique o papel da mídia antes de processar");
  const workspace = await createMediaWorkspace();
  try {
    const downloaded = await downloadMedia(candidate.original_file_url);
    const extension =
      downloaded.mime === "image/gif"
        ? "gif"
        : downloaded.mime === "video/webm"
          ? "webm"
          : "mp4";
    const original = path.join(workspace, `original.${extension}`);
    await writeFile(original, downloaded.buffer);
    return await prepareLocalFile(client, {
      id: candidate.id,
      exerciseSlug: relation.slug,
      inputPath: original,
      trimStart: Number(candidate.trim_start ?? 0),
      trimEnd: candidate.trim_end ? Number(candidate.trim_end) : undefined,
      mediaRole: candidate.media_role,
      posterTimestamp: candidate.poster_timestamp
        ? Number(candidate.poster_timestamp)
        : undefined,
      finalSourceUrl: downloaded.finalUrl,
      downloadedAt: new Date().toISOString(),
    });
  } finally {
    await cleanupMediaWorkspace(workspace);
  }
}
export async function prepareLocalFile(
  client: SupabaseClient,
  input: {
    id?: string;
    exerciseSlug: string;
    inputPath: string;
    trimStart?: number;
    trimEnd?: number;
    mediaRole: MediaRole;
    posterTimestamp?: number;
    finalSourceUrl?: string;
    downloadedAt?: string;
  },
) {
  const workspace = await createMediaWorkspace();
  try {
    const artifact = await prepareLocalArtifact({
      ...input,
      outputDirectory: workspace,
    });
    const { metadata, posterTimestamp, hash } = artifact;
    const duplicateQuery = client
      .from("exercise_media")
      .select("id")
      .eq("content_hash", hash);
    const { data: duplicate } = input.id
      ? await duplicateQuery.neq("id", input.id).maybeSingle()
      : await duplicateQuery.maybeSingle();
    if (duplicate) throw new Error(`Arquivo duplicado: mídia ${duplicate.id}`);
    const { mediaPath, posterPath } = mediaStoragePaths({
      exerciseSlug: input.exerciseSlug,
      role: input.mediaRole,
      hash,
      mediaType: artifact.mediaType,
    });
    const [mediaBytes, posterBytes] = await Promise.all([
      readFile(/* turbopackIgnore: true */ artifact.mediaPath),
      readFile(/* turbopackIgnore: true */ artifact.posterPath),
    ]);
    const mediaUpload = await client.storage
      .from("exercise-media")
      .upload(mediaPath, mediaBytes, {
        contentType: artifact.mediaType === "gif" ? "image/gif" : "video/mp4",
        cacheControl: "31536000",
        upsert: false,
      });
    if (mediaUpload.error) throw mediaUpload.error;
    const posterUpload = await client.storage
      .from("exercise-media")
      .upload(posterPath, posterBytes, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
    if (posterUpload.error) {
      await client.storage.from("exercise-media").remove([mediaPath]);
      throw posterUpload.error;
    }
    return {
      storage_path: mediaPath,
      poster_path: posterPath,
      media_type: artifact.mediaType,
      status: "processed",
      original_file_url: input.finalSourceUrl,
      downloaded_at: input.downloadedAt,
      content_hash: hash,
      poster_timestamp: posterTimestamp,
      processed_at: new Date().toISOString(),
      processing_error: null,
      ready_for_processing: false,
      width: metadata.width,
      height: metadata.height,
      duration_seconds: metadata.durationSeconds,
      file_size_bytes: metadata.fileSizeBytes,
      animation_verified: true,
      frame_count: artifact.frameCount,
      animation_loop: artifact.animationLoop,
      frames_per_second: artifact.framesPerSecond,
      fallback_reason: artifact.fallbackReason,
      quality_score: Math.min(
        100,
        (metadata.width >= 480 ? 30 : 15) +
          (metadata.durationSeconds >= 4 && metadata.durationSeconds <= 12
            ? 30
            : 15) +
          (metadata.fileSizeBytes <= 2 * 1024 * 1024 ? 20 : 10) +
          20,
      ),
    } as const;
  } finally {
    await cleanupMediaWorkspace(workspace);
  }
}

export async function prepareLocalArtifact(input: {
  exerciseSlug: string;
  inputPath: string;
  outputDirectory: string;
  trimStart?: number;
  trimEnd?: number;
  mediaRole: MediaRole;
  posterTimestamp?: number;
}) {
  await mkdir(input.outputDirectory, { recursive: true });
  const gif = path.join(input.outputDirectory, "main.gif");
  const video = path.join(input.outputDirectory, "main.mp4");
  const poster = path.join(input.outputDirectory, "poster.webp");
  let mediaPath = gif;
  let mediaType: "gif" | "video" = "gif";
  let fallbackReason: GifFallbackReason | null = null;
  let gifInspection: Awaited<ReturnType<typeof inspectAnimatedGif>> | null =
    null;
  try {
    await processGif(input.inputPath, gif, {
      trimStart: input.trimStart,
      trimEnd: input.trimEnd,
    });
    gifInspection = await inspectAnimatedGif(gif);
    if (
      !gifInspection.animated ||
      !gifInspection.loop ||
      gifInspection.durationSeconds <= 0
    )
      fallbackReason = "GIF_PROCESSING_FAILED";
    else if (gifInspection.fileSizeBytes > MAX_GIF_BYTES)
      fallbackReason = "GIF_SIZE_TOO_LARGE";
  } catch {
    fallbackReason = "GIF_PROCESSING_FAILED";
  }
  if (fallbackReason) {
    mediaType = "video";
    mediaPath = video;
    await processVideo(input.inputPath, video, {
      trimStart: input.trimStart,
      trimEnd: input.trimEnd,
    });
  }
  const metadata = await probeMedia(mediaPath);
  const posterTimestamp = Math.min(
    Math.max(0.2, input.posterTimestamp ?? metadata.durationSeconds * 0.35),
    Math.max(0.2, metadata.durationSeconds - 0.1),
  );
  await generatePoster(mediaPath, poster, posterTimestamp);
  const hash = await sha256File(mediaPath);
  return {
    mediaPath,
    posterPath: poster,
    mediaType,
    fallbackReason,
    metadata,
    hash,
    posterTimestamp,
    frameCount:
      mediaType === "gif"
        ? (gifInspection?.frameCount ?? 0)
        : metadata.frameCount,
    animationLoop: mediaType === "gif" ? (gifInspection?.loop ?? false) : true,
    framesPerSecond:
      mediaType === "gif"
        ? (gifInspection?.fps ?? 0)
        : numericFrameRate(metadata.frameRate),
  };
}
