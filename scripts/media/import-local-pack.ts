import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import {
  cleanupMediaWorkspace,
  createMediaWorkspace,
  generatePoster,
  probeMedia,
  processVideo,
} from "../../lib/media/ffmpeg.ts";
import { sha256File } from "../../lib/media/hash.ts";
import { getLicense } from "../../lib/media/licenses.ts";
import { getAdminClient, log, parseArgs } from "./shared.ts";

type Manifest = {
  name: string;
  version: string;
  licenseCode: "VITAL-FREE-PACK" | "CUSTOM";
  entries: {
    exerciseSlug: string;
    file: string;
    author?: string;
    attribution?: string;
  }[];
};
const args = parseArgs();
if (!args.manifest || !args.licenseFile)
  throw new Error("Informe --manifest e --license-file");
if (!args.confirmWebRedistribution)
  throw new Error(
    "Revise a EULA e passe --confirm-web-redistribution somente se ela permitir uso no web app",
  );
const manifestPath = path.resolve(args.manifest),
  base = path.dirname(manifestPath),
  licensePath = path.resolve(args.licenseFile);
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
const license = getLicense(manifest.licenseCode);
const client = getAdminClient(!args.dryRun);
if (!client && !args.dryRun) throw new Error("Supabase não configurado");
if (!args.dryRun) {
  const proofTarget = path.resolve(
    "docs/licenses",
    `${manifest.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${manifest.version}.txt`,
  );
  await copyFile(licensePath, proofTarget);
  log("PROCESS", `Comprovante copiado para ${proofTarget}`);
}
for (const entry of manifest.entries) {
  let workspace: string | undefined;
  try {
    const input = path.resolve(base, entry.file);
    if (!input.startsWith(`${base}${path.sep}`))
      throw new Error("Arquivo fora da pasta do manifesto");
    if (args.dryRun) {
      log("PROCESS", `${entry.exerciseSlug}: dry-run ${input}`);
      continue;
    }
    const { data: exercise, error: exerciseError } = await client!
      .from("exercises")
      .select("id,slug")
      .eq("slug", entry.exerciseSlug)
      .single();
    if (exerciseError) throw exerciseError;
    workspace = await createMediaWorkspace();
    const hash = await sha256File(input);
    const { data: duplicate } = await client!
      .from("exercise_media")
      .select("id")
      .eq("content_hash", hash)
      .maybeSingle();
    if (duplicate) {
      log("REJECTED", `${entry.exerciseSlug}: duplicado de ${duplicate.id}`);
      continue;
    }
    const output = path.join(workspace, "main.mp4"),
      poster = path.join(workspace, "poster.webp");
    await processVideo(input, output);
    await generatePoster(output, poster);
    const meta = await probeMedia(output),
      version = hash.slice(0, 12),
      storageBase = `exercises/${exercise.slug}/${version}`;
    const [video, posterBytes] = await Promise.all([
      readFile(output),
      readFile(poster),
    ]);
    const videoResult = await client!.storage
      .from("exercise-media")
      .upload(`${storageBase}/main.mp4`, video, {
        contentType: "video/mp4",
        cacheControl: "31536000",
      });
    if (videoResult.error) throw videoResult.error;
    const posterResult = await client!.storage
      .from("exercise-media")
      .upload(`${storageBase}/poster.webp`, posterBytes, {
        contentType: "image/webp",
        cacheControl: "31536000",
      });
    if (posterResult.error) throw posterResult.error;
    const { error } = await client!
      .from("exercise_media")
      .insert({
        exercise_id: exercise.id,
        media_type: "video",
        storage_path: `${storageBase}/main.mp4`,
        poster_path: `${storageBase}/poster.webp`,
        angle: "main",
        status: "reviewing",
        source_name: manifest.name,
        source_type: license.sourceType,
        source_url: `local-pack://${manifest.name}/${manifest.version}`,
        license_code: license.code,
        license_url: license.url,
        author: entry.author ?? null,
        attribution_text: entry.attribution ?? null,
        attribution_required: license.attributionRequired,
        downloaded_at: new Date().toISOString(),
        content_hash: hash,
        width: meta.width,
        height: meta.height,
        duration_seconds: meta.durationSeconds,
        file_size_bytes: meta.fileSizeBytes,
        candidate_metadata: {
          packVersion: manifest.version,
          originalFilename: entry.file,
        },
      });
    if (error) throw error;
    log("UPLOAD", `${entry.exerciseSlug}: enviado para revisão`);
  } catch (error) {
    log(
      "REJECTED",
      `${entry.exerciseSlug}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    if (workspace) await cleanupMediaWorkspace(workspace);
  }
}
