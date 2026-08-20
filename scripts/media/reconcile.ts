import { createHash } from "node:crypto";
import { reconcileMediaIntegrity } from "../../lib/media/integrity.ts";
import { getAdminClient } from "./shared.ts";

const client = getAdminClient()!;
const { data, error } = await client
  .from("exercise_media")
  .select(
    "id,exercise_id,media_type,storage_path,poster_path,content_hash,animation_verified,frame_count,duration_seconds,animation_loop",
  )
  .eq("status", "approved")
  .eq("media_role", "PRIMARY_DEMO")
  .eq("is_primary", true);
if (error) throw error;

async function listFiles(prefix = ""): Promise<string[]> {
  const { data: entries, error: listError } = await client.storage
    .from("exercise-media")
    .list(prefix, { limit: 1000 });
  if (listError) throw listError;
  const files: string[] = [];
  for (const entry of entries ?? []) {
    const next = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) files.push(next);
    else files.push(...(await listFiles(next)));
  }
  return files;
}

const files = await listFiles();
const records = await Promise.all(
  (data ?? []).map(async (row) => {
    let actualHash: string | null = null;
    if (row.storage_path && files.includes(row.storage_path)) {
      const { data: blob, error: downloadError } = await client.storage
        .from("exercise-media")
        .download(row.storage_path);
      if (downloadError) throw downloadError;
      actualHash = createHash("sha256")
        .update(Buffer.from(await blob.arrayBuffer()))
        .digest("hex");
    }
    return {
      id: row.id,
      exerciseId: row.exercise_id,
      mediaType: row.media_type,
      storagePath: row.storage_path,
      posterPath: row.poster_path,
      contentHash: row.content_hash,
      actualHash,
      animationVerified: row.animation_verified,
      frameCount: row.frame_count,
      durationSeconds: row.duration_seconds,
      animationLoop: row.animation_loop,
    };
  }),
);
const issues = reconcileMediaIntegrity(records, files);
if (issues.length) {
  process.stderr.write(`${JSON.stringify({ ok: false, issues }, null, 2)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `${JSON.stringify({ ok: true, approvedPrimary: records.length, files: files.length })}\n`,
  );
}
