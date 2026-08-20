import { readFile, writeFile } from "node:fs/promises";
import { scoreMediaMatch } from "../../lib/media/matching.ts";
import { expandedAliases } from "../../lib/media/search-queries.ts";
import { fallbackCatalog } from "./catalog.ts";

const file = ".tmp/media-candidates.json";
const videoRank = (candidate: unknown) =>
  (candidate as Record<string, unknown>).mime === "image/gif" ? 0 : 1;
const artifact = JSON.parse(await readFile(file, "utf8")) as {
  generatedAt: string;
  exercises: Array<{
    slug: string;
    name: string;
    queries: string[];
    resultsAnalyzed: number;
    verifiedCategories?: string[];
    missingReason: string | null;
    candidates: Array<Record<string, unknown>>;
  }>;
};
for (const result of artifact.exercises) {
  const seed = fallbackCatalog.find((item) => item.slug === result.slug);
  if (!seed) continue;
  const exercise = {
    ...seed,
    id: result.slug,
    aliases: [
      ...new Set([...seed.aliases, ...(expandedAliases[result.slug] ?? [])]),
    ],
  };
  const rescored = result.candidates
    .map((candidate) => {
      const match = scoreMediaMatch(exercise, {
        title: String(candidate.title ?? ""),
        description: String(candidate.description ?? ""),
        categories: Array.isArray(candidate.categories)
          ? candidate.categories.map(String)
          : [],
        mime: String(candidate.mime ?? ""),
        source: `${candidate.author ?? ""} ${candidate.source ?? ""}`,
      });
      return {
        ...candidate,
        score: match.score,
        confidence: match.confidence,
        positiveReasons: match.positiveReasons,
        negativeReasons: match.negativeReasons,
        matchDetails: match.details,
        eligible: match.eligible,
      };
    })
    .filter((candidate) => candidate.eligible)
    .sort(
      (a, b) =>
        Number(b.score) - Number(a.score) || videoRank(b) - videoRank(a),
    );
  result.candidates = rescored;
  if (!rescored.length && !result.missingReason)
    result.missingReason = "low_match_score";
}
artifact.generatedAt = new Date().toISOString();
await writeFile(file, JSON.stringify(artifact, null, 2), "utf8");
const rows = artifact.exercises.map((item) => {
  const best = item.candidates[0];
  return `${item.name} | ${item.slug} | ${item.queries.length} | ${item.resultsAnalyzed} | ${item.candidates.length} | ${best?.score ?? "—"} | ${best?.confidence ?? item.missingReason}`;
});
const known = new Set(["leg-press", "machine-row", "machine-chest-press"]);
const verifiedCategories = [
  ...new Set(
    artifact.exercises.flatMap((item) => item.verifiedCategories ?? []),
  ),
];
const candidateRows = artifact.exercises.map((item) => {
  const best = item.candidates[0];
  return `${item.name} | ${best?.title ?? "—"} | ${best?.source ?? "—"} | ${best?.licenseCode ?? "—"} | ${best?.score ?? "—"} | ${best ? "pending" : "missing"}`;
});
const missingRows = artifact.exercises
  .filter((item) => item.candidates.length === 0)
  .map(
    (item) =>
      `${item.name} | ${item.missingReason ?? "low_match_score"} | ${item.queries.join("; ")}`,
  );
const sourceRows = (previouslyKnown: boolean) =>
  artifact.exercises
    .filter(
      (item) => known.has(item.slug) === previouslyKnown && item.candidates[0],
    )
    .map((item) => {
      const best = item.candidates[0];
      return `${item.name} | ${best.title} | ${best.source} | ${best.licenseCode} | ${best.score}`;
    });
const unmapped = await readFile(".tmp/unmapped-media.json", "utf8")
  .then(
    (value) =>
      JSON.parse(value) as {
        exercises?: Array<{
          name: string;
          candidates: Array<{
            title: string;
            licenseCode: string;
            score: number;
          }>;
          missingReason: string | null;
        }>;
      },
  )
  .catch(() => ({ exercises: [] }));
const unmappedRows = (unmapped.exercises ?? []).map((item) => {
  const best = item.candidates[0];
  return `${item.name} | ${best?.title ?? "—"} | ${best?.licenseCode ?? "—"} | ${best?.score ?? "—"} | ${best ? "suggested future exercise" : item.missingReason}`;
});
await writeFile(
  "docs/generated-media-discovery-report.md",
  `# VM Training Media Discovery Report\n\nGenerated: ${artifact.generatedAt}\n\n## Verified Wikimedia categories\n\n${verifiedCategories.map((item) => `- ${item}`).join("\n")}\n\n## Query report\n\nExercise | Slug | Queries attempted | Results analyzed | Candidates | Best score | Status\n--- | --- | ---: | ---: | ---: | ---: | ---\n${rows.join("\n")}\n\n## Candidate coverage\n\nExercise | Best Candidate | Source | License | Score | Status\n--- | --- | --- | --- | ---: | ---\n${candidateRows.join("\n")}\n\n## Missing reasons\n\nExercise | Missing Reason | Queries Attempted\n--- | --- | ---\n${missingRows.join("\n") || "No missing exercises."}\n\n## Previously known\n\nExercise | Best Candidate | Source | License | Score\n--- | --- | --- | --- | ---:\n${sourceRows(true).join("\n")}\n\n## Newly discovered\n\nExercise | Best Candidate | Source | License | Score\n--- | --- | --- | --- | ---:\n${sourceRows(false).join("\n")}\n\n## Unmapped valid media\n\nExercise | Best candidate | License | Score | Status\n--- | --- | --- | ---: | ---\n${unmappedRows.join("\n") || "No unmapped search executed."}\n`,
  "utf8",
);
