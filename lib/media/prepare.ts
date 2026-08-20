import type { SupabaseClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { downloadMedia } from "./download.ts";
import {
  cleanupMediaWorkspace,
  createMediaWorkspace,
  generatePoster,
  probeMedia,
  processVideo,
} from "./ffmpeg.ts";
import { sha256File } from "./hash.ts";
import { mediaStoragePaths, type MediaRole } from "./operations.ts";

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
    const output = path.join(workspace, "main.mp4"),
      poster = path.join(workspace, "poster.webp");
    await processVideo(input.inputPath, output, {
      trimStart: input.trimStart,
      trimEnd: input.trimEnd,
    });
    const metadata = await probeMedia(output);
    const posterTimestamp = Math.min(
      Math.max(0.2, input.posterTimestamp ?? metadata.durationSeconds * 0.35),
      Math.max(0.2, metadata.durationSeconds - 0.1),
    );
    await generatePoster(output, poster, posterTimestamp);
    const hash = await sha256File(output);
    const duplicateQuery = client
      .from("exercise_media")
      .select("id")
      .eq("content_hash", hash);
    const { data: duplicate } = input.id
      ? await duplicateQuery.neq("id", input.id).maybeSingle()
      : await duplicateQuery.maybeSingle();
    if (duplicate) throw new Error(`Arquivo duplicado: mídia ${duplicate.id}`);
    const { videoPath, posterPath } = mediaStoragePaths({
      exerciseSlug: input.exerciseSlug,
      role: input.mediaRole,
      hash,
    });
    const [videoBytes, posterBytes] = await Promise.all([
      readFile(output),
      readFile(poster),
    ]);
    const videoUpload = await client.storage
      .from("exercise-media")
      .upload(videoPath, videoBytes, {
        contentType: "video/mp4",
        cacheControl: "31536000",
        upsert: false,
      });
    if (videoUpload.error) throw videoUpload.error;
    const posterUpload = await client.storage
      .from("exercise-media")
      .upload(posterPath, posterBytes, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
    if (posterUpload.error) {
      await client.storage.from("exercise-media").remove([videoPath]);
      throw posterUpload.error;
    }
    return {
      storage_path: videoPath,
      poster_path: posterPath,
      media_type: "video",
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
      quality_score: Math.min(
        100,
        (metadata.width >= 720 ? 30 : 15) +
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
