import { mkdir, writeFile } from "node:fs/promises";
import { discoverWikimedia, flushWikimediaCache } from "./wikimedia.ts";
import type { MatchExercise } from "../../lib/media/types.ts";

const rows: MatchExercise[] = [
  {
    id: "future-squat",
    slug: "base-squat",
    namePt: "Agachamento livre",
    nameEn: "Squat exercise",
    aliases: ["bodyweight squat", "air squat"],
    movementPattern: "squat",
    equipment: ["bodyweight"],
    muscles: ["quadriceps", "glute"],
  },
  {
    id: "future-bench",
    slug: "bench-press",
    namePt: "Supino com barra",
    nameEn: "Bench press",
    aliases: ["barbell bench press"],
    movementPattern: "horizontal_push",
    equipment: ["barbell", "bench"],
    muscles: ["chest", "triceps"],
  },
  {
    id: "future-row",
    slug: "bent-over-row",
    namePt: "Remada curvada",
    nameEn: "Bent-over row",
    aliases: ["barbell bent over row"],
    movementPattern: "horizontal_pull",
    equipment: ["barbell"],
    muscles: ["back", "biceps"],
  },
  {
    id: "future-deadlift",
    slug: "deadlift",
    namePt: "Levantamento terra",
    nameEn: "Deadlift",
    aliases: ["barbell deadlift"],
    movementPattern: "hinge",
    equipment: ["barbell"],
    muscles: ["glute", "hamstring", "back"],
  },
  {
    id: "future-pull-up",
    slug: "pull-up",
    namePt: "Barra fixa",
    nameEn: "Pull-up",
    aliases: ["pull up exercise"],
    movementPattern: "vertical_pull",
    equipment: ["bodyweight", "pull up bar"],
    muscles: ["back", "biceps"],
  },
  {
    id: "future-leg-raise",
    slug: "leg-raise",
    namePt: "Elevação de pernas",
    nameEn: "Leg raise",
    aliases: ["lying leg raise"],
    movementPattern: "core_anti_extension",
    equipment: ["bodyweight"],
    muscles: ["abdominal", "core"],
  },
];
const results = [];
for (const exercise of rows) {
  const discovery = await discoverWikimedia(exercise, 2);
  results.push({
    slug: exercise.slug,
    name: exercise.namePt,
    candidates: discovery.candidates.map((candidate) => ({
      title: candidate.title,
      sourceUrl: candidate.sourceUrl,
      source: "Wikimedia Commons",
      licenseCode: candidate.license.code,
      licenseUrl: candidate.license.url,
      author: candidate.author,
      score: candidate.match.score,
      confidence: candidate.match.confidence,
      status: "unmapped",
    })),
    missingReason: discovery.missingReason,
  });
  await flushWikimediaCache();
}
await mkdir(".tmp", { recursive: true });
await writeFile(
  ".tmp/unmapped-media.json",
  JSON.stringify(
    { generatedAt: new Date().toISOString(), exercises: results },
    null,
    2,
  ),
  "utf8",
);
