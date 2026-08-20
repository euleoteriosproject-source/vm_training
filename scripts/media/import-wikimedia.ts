import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  cleanupMediaWorkspace,
  createMediaWorkspace,
  generatePoster,
  probeMedia,
  processVideo,
} from "../../lib/media/ffmpeg.ts";
import { sha256File } from "../../lib/media/hash.ts";
import { downloadMedia } from "../../lib/media/download.ts";
import { getAdminClient, log, parseArgs } from "./shared.ts";

const args = parseArgs();
const client = getAdminClient();
if (!client) throw new Error("Supabase não configurado");
let query = client
  .from("exercise_media")
  .select(
    "id,original_file_url,trim_start,trim_end,content_hash,exercise:exercises(slug)",
  )
  .in("status", ["pending", "reviewing"])
  .in("source_type", ["public_domain", "creative_commons"])
  .not("original_file_url", "is", null)
  .order("match_score", { ascending: false });
if (args.id) query = query.eq("id", args.id);
const { data, error } = await query;
if (error) throw error;
let imported = 0,
  failed = 0;
for (const candidate of data ?? []) {
  let workspace: string | undefined;
  try {
    const exercise = candidate.exercise as unknown as { slug: string } | null;
    if (!exercise) throw new Error("Exercício ausente");
    if (args.dryRun) {
      log(
        "DOWNLOAD",
        `${candidate.id}: dry-run ${candidate.original_file_url}`,
      );
      continue;
    }
    workspace = await createMediaWorkspace();
    log("DOWNLOAD", `${candidate.id}: baixando original`);
    const downloaded = await downloadMedia(candidate.original_file_url!);
    const extension =
      downloaded.mime === "image/gif"
        ? "gif"
        : downloaded.mime === "video/webm"
          ? "webm"
          : "mp4";
    const original = path.join(workspace, `original.${extension}`);
    await writeFile(original, downloaded.buffer);
    const hash = await sha256File(original);
    const { data: duplicate } = await client
      .from("exercise_media")
      .select("id,storage_path,poster_path")
      .eq("content_hash", hash)
      .neq("id", candidate.id)
      .maybeSingle();
    if (duplicate) {
      await client
        .from("exercise_media")
        .update({
          status: "rejected",
          review_notes: `Duplicado de ${duplicate.id}`,
          content_hash: null,
        })
        .eq("id", candidate.id);
      log("REJECTED", `${candidate.id}: hash duplicado de ${duplicate.id}`);
      continue;
    }
    const output = path.join(workspace, "main.mp4"),
      poster = path.join(workspace, "poster.webp");
    log("PROCESS", `${candidate.id}: convertendo H.264 e gerando poster`);
    await processVideo(original, output, {
      trimStart: Number(candidate.trim_start ?? 0),
      trimEnd: candidate.trim_end ? Number(candidate.trim_end) : undefined,
    });
    await generatePoster(
      output,
      poster,
      Math.min(2, Math.max(0.2, Number(candidate.trim_end ?? 2) / 2)),
    );
    const metadata = await probeMedia(output);
    const version = hash.slice(0, 12);
    const base = `exercises/${exercise.slug}/${version}`;
    const [videoBytes, posterBytes] = await Promise.all([
      readFile(output),
      readFile(poster),
    ]);
    const videoUpload = await client.storage
      .from("exercise-media")
      .upload(`${base}/main.mp4`, videoBytes, {
        contentType: "video/mp4",
        cacheControl: "31536000",
        upsert: false,
      });
    if (videoUpload.error) throw videoUpload.error;
    const posterUpload = await client.storage
      .from("exercise-media")
      .upload(`${base}/poster.webp`, posterBytes, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
    if (posterUpload.error) {
      await client.storage.from("exercise-media").remove([`${base}/main.mp4`]);
      throw posterUpload.error;
    }
    const { error: updateError } = await client
      .from("exercise_media")
      .update({
        storage_path: `${base}/main.mp4`,
        poster_path: `${base}/poster.webp`,
        media_type: "video",
        status: "reviewing",
        original_file_url: downloaded.finalUrl,
        downloaded_at: new Date().toISOString(),
        content_hash: hash,
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
      })
      .eq("id", candidate.id);
    if (updateError) throw updateError;
    imported++;
    log("UPLOAD", `${candidate.id}: ${base}/main.mp4`);
  } catch (importError) {
    failed++;
    log(
      "REJECTED",
      `${candidate.id}: ${importError instanceof Error ? importError.message : String(importError)}`,
    );
  } finally {
    if (workspace) await cleanupMediaWorkspace(workspace);
  }
}
log("PROCESS", `Concluído: ${imported} processados, ${failed} falharam.`);
