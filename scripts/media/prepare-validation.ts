import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { downloadMedia } from "../../lib/media/download.ts";
import {
  generateContactSheet,
  probeMedia,
} from "../../lib/media/ffmpeg.ts";
import { getAdminClient, parseArgs } from "./shared.ts";

type Candidate = {
  title: string;
  sourceUrl: string;
  originalFileUrl: string;
  source: string;
  licenseCode: string;
  licenseUrl: string;
  author: string;
  attributionText: string;
  mime: "video/webm" | "video/mp4" | "image/gif";
  score: number;
  confidence: string;
};

type Artifact = {
  version?: string;
  generatedAt?: string;
  exercises: Array<{
    id: string;
    slug: string;
    name: string;
    candidates: Candidate[];
  }>;
};

type DatabaseRow = {
  id: string;
  exercise_id: string;
  source_url: string;
  status: string;
  media_role: string | null;
  exercises: { slug: string } | { slug: string }[] | null;
};

const args = parseArgs();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const input = args.input ?? "data/media/media-candidates.json";
const outputRoot = path.resolve(".tmp", "media-validation");
const originalRoot = path.join(outputRoot, "original");
const contactSheetRoot = path.join(outputRoot, "contact-sheets");
const artifact = JSON.parse(await readFile(input, "utf8")) as Artifact;

await mkdir(originalRoot, { recursive: true });
await mkdir(contactSheetRoot, { recursive: true });

const client = getAdminClient(false);
let databaseRows: DatabaseRow[] = [];
let databaseAvailable = false;
let databaseError: string | null = null;
if (client) {
  try {
    const { data, error } = await client
      .from("exercise_media")
      .select("id,exercise_id,source_url,status,media_role,exercises!inner(slug)");
    if (error) throw error;
    databaseRows = (data ?? []) as DatabaseRow[];
    databaseAvailable = true;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : String(error);
  }
}

const databaseByIdentity = new Map(
  databaseRows.map((row) => {
    const relation = Array.isArray(row.exercises)
      ? row.exercises[0]
      : row.exercises;
    return [`${relation?.slug ?? row.exercise_id}\0${row.source_url}`, row];
  }),
);
const downloadedByUrl = new Map<
  string,
  {
    path: string;
    httpStatus: number;
    finalUrl: string;
    mime: string;
    sha256: string;
    probe: Awaited<ReturnType<typeof probeMedia>>;
  }
>();
const inventoryCandidates: Record<string, unknown>[] = [];

for (const exercise of artifact.exercises) {
  for (const candidate of exercise.candidates) {
    const candidateId = createHash("sha256")
      .update(`${exercise.slug}\0${candidate.sourceUrl}`)
      .digest("hex")
      .slice(0, 16);
    const extension =
      candidate.mime === "image/gif"
        ? ".gif"
        : candidate.mime === "video/mp4"
          ? ".mp4"
          : ".webm";
    const exerciseDirectory = path.join(originalRoot, exercise.slug);
    const originalPath = path.join(exerciseDirectory, `${candidateId}${extension}`);
    const contactSheetPath = path.join(contactSheetRoot, `${candidateId}.webp`);
    await mkdir(exerciseDirectory, { recursive: true });

    let technical = downloadedByUrl.get(candidate.originalFileUrl);
    let downloadError: string | null = null;
    try {
      if (!technical) {
        let existing: Buffer | null = null;
        try {
          existing = await readFile(originalPath);
        } catch {
          /* Resume downloads already completed by an earlier run. */
        }
        const downloaded = existing
          ? {
              buffer: existing,
              httpStatus: 200,
              mime: candidate.mime,
              finalUrl: candidate.originalFileUrl,
            }
            : await downloadMedia(candidate.originalFileUrl, {
              maxMb: 500,
              timeoutMs: 120_000,
              retries: 3,
            });
        if (!existing) {
          await writeFile(originalPath, downloaded.buffer);
          await sleep(3_000);
        }
        const probe = await probeMedia(originalPath);
        technical = {
          path: originalPath,
          httpStatus: downloaded.httpStatus,
          finalUrl: downloaded.finalUrl,
          mime: downloaded.mime,
          sha256: createHash("sha256").update(downloaded.buffer).digest("hex"),
          probe,
        };
        downloadedByUrl.set(candidate.originalFileUrl, technical);
      } else {
        await copyFile(technical.path, originalPath);
      }
      await generateContactSheet(
        originalPath,
        contactSheetPath,
        technical.probe.durationSeconds,
      );
    } catch (error) {
      downloadError = error instanceof Error ? error.message : String(error);
    }

    const database = databaseByIdentity.get(
      `${exercise.slug}\0${candidate.sourceUrl}`,
    );
    inventoryCandidates.push({
      candidateId,
      exerciseId: exercise.id,
      exerciseSlug: exercise.slug,
      expectedExercise: exercise.name,
      title: candidate.title,
      sourceUrl: candidate.sourceUrl,
      originalFileUrl: candidate.originalFileUrl,
      source: candidate.source,
      licenseCode: candidate.licenseCode,
      licenseUrl: candidate.licenseUrl,
      author: candidate.author,
      attributionText: candidate.attributionText,
      discoveryScore: candidate.score,
      discoveryConfidence: candidate.confidence,
      declaredMime: candidate.mime,
      originalPath: technical ? path.relative(process.cwd(), originalPath) : null,
      contactSheetPath: technical
        ? path.relative(process.cwd(), contactSheetPath)
        : null,
      download: technical
        ? {
            ok: true,
            httpStatus: technical.httpStatus,
            finalUrl: technical.finalUrl,
            contentType: technical.mime,
            sha256: technical.sha256,
          }
        : { ok: false, error: downloadError },
      technical: technical?.probe ?? null,
      database: database
        ? {
            found: true,
            id: database.id,
            status: database.status,
            mediaRole: database.media_role,
          }
        : { found: false },
    });
    process.stdout.write(
      `[${technical ? "READY" : "FAILED"}] ${exercise.slug} ${candidateId} ${candidate.title}\n`,
    );
  }
}

const inventory = {
  version: "1.5",
  generatedAt: new Date().toISOString(),
  sourceArtifact: input,
  sourceVersion: artifact.version ?? null,
  sourceGeneratedAt: artifact.generatedAt ?? null,
  summary: {
    totalCandidates: inventoryCandidates.length,
    exercisesWithCandidates: new Set(
      inventoryCandidates.map((candidate) => candidate.exerciseSlug),
    ).size,
    uniqueAssets: downloadedByUrl.size,
    downloaded: inventoryCandidates.filter(
      (candidate) => (candidate.download as { ok: boolean }).ok,
    ).length,
    failed: inventoryCandidates.filter(
      (candidate) => !(candidate.download as { ok: boolean }).ok,
    ).length,
  },
  databaseReconciliation: {
    available: databaseAvailable,
    error: databaseError,
    totalRows: databaseRows.length,
    pending: databaseRows.filter((row) => row.status === "pending").length,
    approved: databaseRows.filter((row) => row.status === "approved").length,
  },
  candidates: inventoryCandidates,
};

await writeFile(
  path.join(outputRoot, "inventory.json"),
  `${JSON.stringify(inventory, null, 2)}\n`,
);
process.stdout.write(
  `Inventory: ${path.join(outputRoot, "inventory.json")}\nCandidates: ${inventory.summary.totalCandidates}\nExercises: ${inventory.summary.exercisesWithCandidates}\nDownloaded: ${inventory.summary.downloaded}\nFailed: ${inventory.summary.failed}\n`,
);
if (inventory.summary.failed > 0) process.exitCode = 1;
