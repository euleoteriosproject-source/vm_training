import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { seededPendingCandidateSlugs } from "./catalog.ts";
import { discoverWikimedia, flushWikimediaCache } from "./wikimedia.ts";
import { getAdminClient, loadExercises, log, parseArgs } from "./shared.ts";

const args = parseArgs();
if (args.source && args.source !== "wikimedia")
  throw new Error("Fonte suportada neste comando: wikimedia");
const client = getAdminClient(!args.dryRun);
let exercises = (await loadExercises(client)).filter(
  (exercise) => !args.exercise || exercise.slug === args.exercise,
);
const shouldFilterMissing = !args.force && (args.missingOnly || !args.dryRun);
if (shouldFilterMissing) {
  if (client) {
    const { data: existing, error } = await client
      .from("exercise_media")
      .select("exercise_id")
      .in("status", ["pending", "reviewing", "approved"]);
    if (error) throw error;
    const covered = new Set((existing ?? []).map((item) => item.exercise_id));
    exercises = exercises.filter((exercise) => !covered.has(exercise.id));
  } else
    exercises = exercises.filter(
      (exercise) => !seededPendingCandidateSlugs.has(exercise.slug),
    );
}
if (args.exercise && exercises.length === 0)
  throw new Error(`Exercício não encontrado ou já coberto: ${args.exercise}`);

const artifactPath = path.resolve(args.output ?? ".tmp/media-candidates.json");
const previous = args.resume
  ? await readFile(artifactPath, "utf8")
      .then(
        (value) =>
          JSON.parse(value) as { exercises?: Array<Record<string, unknown>> },
      )
      .catch(() => ({ exercises: [] }))
  : { exercises: [] as Array<Record<string, unknown>> };
if (args.resume) {
  const completed = new Set(
    (previous.exercises ?? []).map((item) => String(item.slug)),
  );
  exercises = exercises.filter((exercise) => !completed.has(exercise.slug));
}
const artifact = {
  version: "1.2",
  generatedAt: new Date().toISOString(),
  dryRun: args.dryRun,
  exercises: [...(previous.exercises ?? [])] as Array<{
    id: string;
    slug: string;
    name: string;
    queries: string[];
    resultsAnalyzed: number;
    mediaResults: number;
    licensedResults: number;
    rejectedLicenses: number;
    missingReason: string | null;
    verifiedCategories: string[];
    candidates: Array<Record<string, unknown>>;
  }>,
};
await mkdir(path.dirname(artifactPath), { recursive: true });
let discovered = 0,
  created = 0,
  failed = 0;
for (const exercise of exercises) {
  try {
    log("DISCOVER", `${exercise.slug}: busca multi-query + categorias + CDC`);
    const result = await discoverWikimedia(exercise, args.limit);
    artifact.exercises.push({
      id: exercise.id,
      slug: exercise.slug,
      name: exercise.namePt,
      queries: result.queries,
      resultsAnalyzed: result.resultsAnalyzed,
      mediaResults: result.mediaResults,
      licensedResults: result.licensedResults,
      rejectedLicenses: result.rejectedLicenses,
      missingReason: result.missingReason,
      verifiedCategories: result.verifiedCategories,
      candidates: result.candidates.map((candidate) => ({
        title: candidate.title,
        sourceUrl: candidate.sourceUrl,
        originalFileUrl: candidate.originalFileUrl,
        source: "Wikimedia Commons",
        licenseCode: candidate.license.code,
        licenseUrl: candidate.license.url,
        author: candidate.author,
        attributionText: candidate.attributionText,
        mime: candidate.mime,
        width: candidate.width,
        height: candidate.height,
        durationSeconds: candidate.durationSeconds,
        date: candidate.date,
        score: candidate.match.score,
        confidence: candidate.match.confidence,
        positiveReasons: candidate.match.positiveReasons,
        negativeReasons: candidate.match.negativeReasons,
        matchDetails: candidate.match.details,
        description: candidate.description,
        categories: candidate.categories,
        rawMetadata: candidate.rawMetadata,
      })),
    });
    for (const candidate of result.candidates) {
      discovered++;
      log(
        "DISCOVER",
        `${exercise.slug} <- ${candidate.title} | ${candidate.license.code} | ${candidate.match.confidence} ${candidate.match.score}`,
      );
      if (args.dryRun || !client) continue;
      const { error } = await client.from("exercise_media").upsert(
        {
          exercise_id: exercise.id,
          media_type: candidate.mime === "image/gif" ? "gif" : "video",
          storage_path: null,
          angle: "main",
          status: "pending",
          source_name: "Wikimedia Commons",
          source_type: candidate.license.sourceType,
          source_url: candidate.sourceUrl,
          license_code: candidate.license.code,
          license_url: candidate.license.url,
          author: candidate.author,
          attribution_text: candidate.attributionText,
          attribution_required: candidate.license.attributionRequired,
          original_file_url: candidate.originalFileUrl,
          file_size_bytes: candidate.fileSizeBytes,
          width: candidate.width,
          height: candidate.height,
          duration_seconds: candidate.durationSeconds,
          match_score: candidate.match.score,
          match_details: candidate.match.details,
          candidate_metadata: {
            title: candidate.title,
            description: candidate.description,
            categories: candidate.categories,
            date: candidate.date,
            confidence: candidate.match.confidence,
            metadata: candidate.rawMetadata,
          },
        },
        { onConflict: "exercise_id,source_url", ignoreDuplicates: true },
      );
      if (error) throw error;
      created++;
    }
    if (!result.candidates.length)
      log("REJECTED", `${exercise.slug}: ${result.missingReason}`);
  } catch (error) {
    failed++;
    artifact.exercises.push({
      id: exercise.id,
      slug: exercise.slug,
      name: exercise.namePt,
      queries: [],
      resultsAnalyzed: 0,
      mediaResults: 0,
      licensedResults: 0,
      rejectedLicenses: 0,
      missingReason: "discovery_error",
      verifiedCategories: [],
      candidates: [],
    });
    log(
      "REJECTED",
      `${exercise.slug}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  await flushWikimediaCache();
  await writeFile(artifactPath, JSON.stringify(artifact, null, 2), "utf8");
}
await flushWikimediaCache();
await writeFile(artifactPath, JSON.stringify(artifact, null, 2), "utf8");
const reportRows = artifact.exercises.map((item) => {
  const best = item.candidates[0] as
    { score?: number; confidence?: string } | undefined;
  return `${item.name} | ${item.slug} | ${item.queries.length} | ${item.resultsAnalyzed} | ${item.candidates.length} | ${best?.score ?? "—"} | ${best?.confidence ?? item.missingReason}`;
});
const report = `# VM Training Media Discovery Report\n\nGenerated: ${artifact.generatedAt}\n\nExercise | Slug | Queries attempted | Results analyzed | Candidates | Best score | Status\n--- | --- | ---: | ---: | ---: | ---: | ---\n${reportRows.join("\n")}\n\n## Verified Wikimedia categories\n\n${[...new Set(artifact.exercises.flatMap((item) => item.verifiedCategories))].map((item) => `- ${item}`).join("\n") || "- None"}\n`;
await writeFile(
  path.resolve("docs/generated-media-discovery-report.md"),
  report,
  "utf8",
);
log("REPORT", `Artefato: ${artifactPath}`);
log("REPORT", "Relatório: docs/generated-media-discovery-report.md");
log(
  "DISCOVER",
  `Concluído: ${discovered} candidatos, ${created} persistidos, ${failed} exercícios com falha.`,
);
