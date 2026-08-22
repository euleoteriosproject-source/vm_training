import { readFile } from "node:fs/promises";
import { getAdminClient, parseArgs } from "./shared.ts";

type LocalCandidate = {
  title: string;
  sourceUrl: string;
  originalFileUrl: string;
  source: string;
  licenseCode: string;
  licenseUrl: string;
  author: string;
  attributionText: string;
  mime: string;
  width?: number;
  height?: number;
  durationSeconds?: number | null;
  fileSizeBytes?: number | null;
  score: number;
  confidence: string;
  positiveReasons: string[];
  negativeReasons: string[];
  matchDetails: Record<string, unknown>;
  description?: string;
  categories?: string[];
  rawMetadata?: Record<string, unknown>;
  date?: string;
};

type Artifact = {
  exercises?: Array<{
    slug: string;
    candidates?: LocalCandidate[];
  }>;
};

const client = getAdminClient();
const args = parseArgs();
const artifactPath = args.input ?? "data/media/media-candidates.json";
const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as Artifact;
const { data: exercises, error: exerciseError } = await client!
  .from("exercises")
  .select("id,slug");
if (exerciseError) throw exerciseError;
const exerciseIds = new Map((exercises ?? []).map((row) => [row.slug, row.id]));

let read = 0;
let inserted = 0;
let existing = 0;
let failed = 0;

for (const exercise of artifact.exercises ?? []) {
  const exerciseId = exerciseIds.get(exercise.slug);
  for (const candidate of exercise.candidates ?? []) {
    read++;
    if (!exerciseId) {
      failed++;
      process.stderr.write(
        `[FAILED] ${exercise.slug}: exercício não encontrado\n`,
      );
      continue;
    }
    const { data: duplicate, error: duplicateError } = await client!
      .from("exercise_media")
      .select("id")
      .eq("exercise_id", exerciseId)
      .eq("source_url", candidate.sourceUrl)
      .maybeSingle();
    if (duplicateError) {
      failed++;
      process.stderr.write(
        `[FAILED] ${candidate.sourceUrl}: ${duplicateError.message}\n`,
      );
      continue;
    }
    if (duplicate) {
      existing++;
      continue;
    }
    const attributionRequired = candidate.licenseCode.startsWith("CC-BY");
    const { error } = await client!.from("exercise_media").insert({
      exercise_id: exerciseId,
      media_type: candidate.mime === "image/gif" ? "gif" : "video",
      storage_path: null,
      angle: "main",
      status: "pending",
      media_role: null,
      execution_quality: "unreviewed",
      source_name: candidate.source,
      source_type:
        candidate.licenseCode === "PD" || candidate.licenseCode === "CC0-1.0"
          ? "public_domain"
          : "creative_commons",
      source_url: candidate.sourceUrl,
      original_file_url: candidate.originalFileUrl,
      license_code: candidate.licenseCode,
      license_url: candidate.licenseUrl,
      author: candidate.author,
      attribution_text: candidate.attributionText,
      attribution_required: attributionRequired,
      width: candidate.width ?? null,
      height: candidate.height ?? null,
      duration_seconds: candidate.durationSeconds ?? null,
      file_size_bytes: candidate.fileSizeBytes ?? null,
      match_score: candidate.score,
      match_details: {
        ...candidate.matchDetails,
        positiveReasons: candidate.positiveReasons,
        negativeReasons: candidate.negativeReasons,
      },
      candidate_metadata: {
        title: candidate.title,
        description: candidate.description,
        confidence: candidate.confidence,
        categories: candidate.categories,
        rawMetadata: candidate.rawMetadata,
        date: candidate.date,
        mime: candidate.mime,
      },
    });
    if (error) {
      failed++;
      process.stderr.write(
        `[FAILED] ${candidate.sourceUrl}: ${error.message}\n`,
      );
    } else {
      inserted++;
    }
  }
}

process.stdout.write(
  `Candidates read: ${read}\nInserted: ${inserted}\nAlready existing: ${existing}\nFailed: ${failed}\n`,
);
if (failed) process.exitCode = 1;
