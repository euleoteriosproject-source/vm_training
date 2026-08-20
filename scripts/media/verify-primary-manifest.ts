import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const manifest = JSON.parse(
  await readFile("data/media/primary-media-manifest.json", "utf8"),
) as {
  strategy: string;
  entries: Array<{
    exerciseSlug: string;
    mediaType: string;
    fallbackReason: string | null;
    storagePath: string;
    posterPath: string;
    posterHash: string;
    contentHash: string;
    animated: boolean;
    frameCount: number;
    durationSeconds: number;
    loop: boolean;
    visualReview: { approved: boolean };
  }>;
};
const failures: string[] = [];
if (manifest.strategy !== "GIF-FIRST") failures.push("strategy_not_gif_first");
if (manifest.entries.length !== 7) failures.push("primary_count_not_7");
const slugs = new Set<string>();
for (const entry of manifest.entries) {
  if (slugs.has(entry.exerciseSlug))
    failures.push(`duplicate_primary:${entry.exerciseSlug}`);
  slugs.add(entry.exerciseSlug);
  if (entry.mediaType === "image")
    failures.push(`static_primary:${entry.exerciseSlug}`);
  if (!entry.animated || entry.durationSeconds <= 0)
    failures.push(`not_animated:${entry.exerciseSlug}`);
  if (
    entry.mediaType === "gif" &&
    (entry.frameCount <= 1 || !entry.loop || entry.fallbackReason)
  )
    failures.push(`invalid_gif:${entry.exerciseSlug}`);
  if (entry.mediaType === "video" && !entry.fallbackReason)
    failures.push(`undocumented_video_fallback:${entry.exerciseSlug}`);
  if (
    !entry.storagePath.includes(entry.contentHash) ||
    !entry.posterPath.endsWith(".webp") ||
    !/^[a-f0-9]{64}$/.test(entry.posterHash)
  )
    failures.push(`invalid_storage_identity:${entry.exerciseSlug}`);
  if (!entry.visualReview.approved)
    failures.push(`visual_review_pending:${entry.exerciseSlug}`);
}

let localHashChecks = 0;
for (const entry of manifest.entries) {
  const directory = path.join(
    ".tmp",
    "media-processing",
    "v16",
    entry.exerciseSlug,
  );
  try {
    const [media, poster] = await Promise.all([
      readFile(path.join(directory, "final.gif")),
      readFile(path.join(directory, "poster.webp")),
    ]);
    const mediaHash = createHash("sha256").update(media).digest("hex");
    const posterHash = createHash("sha256").update(poster).digest("hex");
    if (mediaHash !== entry.contentHash)
      failures.push(`CONTENT_HASH_MISMATCH:${entry.exerciseSlug}`);
    if (posterHash !== entry.posterHash)
      failures.push(`POSTER_HASH_MISMATCH:${entry.exerciseSlug}`);
    localHashChecks++;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
if (failures.length)
  throw new Error(`Manifesto PRIMARY inválido: ${failures.join(", ")}`);
process.stdout.write(
  `Manifesto GIF-first válido: ${manifest.entries.length} PRIMARY_DEMO animadas; posterHash ${manifest.entries.length}/7; hashes locais ${localHashChecks}/7.\n`,
);
