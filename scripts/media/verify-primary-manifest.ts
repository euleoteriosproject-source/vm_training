import { readFile } from "node:fs/promises";

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
    !entry.posterPath.endsWith(".webp")
  )
    failures.push(`invalid_storage_identity:${entry.exerciseSlug}`);
  if (!entry.visualReview.approved)
    failures.push(`visual_review_pending:${entry.exerciseSlug}`);
}
if (failures.length)
  throw new Error(`Manifesto PRIMARY inválido: ${failures.join(", ")}`);
process.stdout.write(
  `Manifesto GIF-first válido: ${manifest.entries.length} PRIMARY_DEMO animadas.\n`,
);
