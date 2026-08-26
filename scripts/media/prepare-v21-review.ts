import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateContactSheet, probeMedia } from "../../lib/media/ffmpeg.ts";
import { sha256File } from "../../lib/media/hash.ts";

const INPUT_PATH = path.resolve("data/media/media-v21-discovery.json");
const OUTPUT_PATH = path.resolve("data/media/media-v21-review.json");
const SOURCE_DIRECTORY = path.resolve(".tmp/media-v21/sources");
const REVIEW_DIRECTORY = path.resolve(".tmp/media-v21/contact-sheets");
const ALLOWED_HOSTS = new Set(["upload.wikimedia.org"]);

type Candidate = {
  exerciseSlug: string;
  found: boolean;
  title: string | null;
  sourceUrl: string | null;
  originalFileUrl: string | null;
  mime: string | null;
  fileSizeBytes: number | null;
  width: number | null;
  height: number | null;
  author: string | null;
  licenseCode: string | null;
  licenseUrl: string | null;
  attributionRequired: boolean | null;
  description: string | null;
};
type Discovery = {
  version: string;
  source: string;
  candidates: Candidate[];
};

async function download(candidate: Candidate, target: string) {
  if (!candidate.originalFileUrl)
    throw new Error(`${candidate.exerciseSlug}: URL original ausente`);
  const url = new URL(candidate.originalFileUrl);
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname))
    throw new Error(`${candidate.exerciseSlug}: origem nao permitida`);
  let bytes: Buffer | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "VMTrainingMediaReview/2.1" },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) {
      bytes = Buffer.from(await response.arrayBuffer());
      break;
    }
    if (response.status !== 429 || attempt === 2)
      throw new Error(
        `${candidate.exerciseSlug}: download HTTP ${response.status}`,
      );
    const retryAfter = Number(response.headers.get("retry-after") ?? 0);
    if (retryAfter > 30)
      throw new Error(
        `${candidate.exerciseSlug}: provider_deferred_${retryAfter}s`,
      );
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(2_000, retryAfter * 1_000, 2 ** attempt * 1_000)),
    );
  }
  if (!bytes) throw new Error(`${candidate.exerciseSlug}: download vazio`);
  if (candidate.fileSizeBytes && bytes.length !== candidate.fileSizeBytes)
    throw new Error(`${candidate.exerciseSlug}: tamanho da fonte diverge`);
  await writeFile(target, bytes);
  await new Promise((resolve) => setTimeout(resolve, 350));
}

const dataset = JSON.parse(await readFile(INPUT_PATH, "utf8")) as Discovery;
if (dataset.version !== "2.1-discovery")
  throw new Error("Dataset de descoberta v2.1 invalido");
await Promise.all([
  mkdir(SOURCE_DIRECTORY, { recursive: true }),
  mkdir(REVIEW_DIRECTORY, { recursive: true }),
]);

const reviewed = [];
for (const candidate of dataset.candidates) {
  try {
    if (
      !candidate.found ||
      !candidate.licenseCode ||
      !candidate.licenseUrl ||
      !candidate.sourceUrl
    )
      throw new Error("metadados incompletos");
    const sourcePath = path.join(
      SOURCE_DIRECTORY,
      `${candidate.exerciseSlug}.webm`,
    );
    try {
      const metadata = await probeMedia(sourcePath);
      if (
        candidate.fileSizeBytes &&
        metadata.fileSizeBytes !== candidate.fileSizeBytes
      )
        throw new Error("cache divergente");
    } catch {
      await download(candidate, sourcePath);
    }
    const metadata = await probeMedia(sourcePath);
    const contactSheetPath = path.join(
      REVIEW_DIRECTORY,
      `${candidate.exerciseSlug}.webp`,
    );
    await generateContactSheet(
      sourcePath,
      contactSheetPath,
      metadata.durationSeconds,
    );
    reviewed.push({
      ...candidate,
      sourceSha256: await sha256File(sourcePath),
      sourceMetadata: metadata,
      localSource: path
        .relative(process.cwd(), sourcePath)
        .replaceAll("\\", "/"),
      contactSheet: path
        .relative(process.cwd(), contactSheetPath)
        .replaceAll("\\", "/"),
      visualDecision: "PENDING",
      visualNotes: null,
    });
    console.log(
      `${candidate.exerciseSlug}: ${metadata.width}x${metadata.height}, ${metadata.durationSeconds}s, contato gerado`,
    );
  } catch (error) {
    reviewed.push({
      ...candidate,
      visualDecision: "DOWNLOAD_FAILED",
      visualNotes: error instanceof Error ? error.message : String(error),
    });
    console.warn(
      `${candidate.exerciseSlug}: indisponivel nesta rodada (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

await writeFile(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      version: "2.1-review",
      projectRef: "inghftngeritrsezwxnm",
      remoteWrites: 0,
      candidates: reviewed,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(`V21 review preparado: ${reviewed.filter((item) => item.visualDecision === "PENDING").length}/${reviewed.length}; zero writes remotos.`);
