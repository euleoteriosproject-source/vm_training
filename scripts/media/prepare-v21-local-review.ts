import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateContactSheet, probeMedia } from "../../lib/media/ffmpeg.ts";
import { sha256File } from "../../lib/media/hash.ts";

const VALIDATION_PATH = path.resolve("data/media/media-validation-v15.json");
const OUTPUT_PATH = path.resolve("data/media/media-v21-local-review.json");
const REVIEW_DIRECTORY = path.resolve(".tmp/media-v21/local-contact-sheets");

const targets = [
  {
    exerciseSlug: "bodyweight-half-squat",
    sourceTitle: "Muscle Strengthening at Home - Half squat.webm",
    sourcePath: ".tmp/media-validation/original/hack-squat/72f6dc978f353ead.webm",
  },
  {
    exerciseSlug: "chair-squat",
    sourceTitle: "Squat-CDC strength training for older adults.gif",
    sourcePath: ".tmp/media-validation/original/hack-squat/e2b4801df9db6b26.gif",
  },
  {
    exerciseSlug: "dumbbell-floor-press",
    sourceTitle: "Chest press-CDC strength training for older adults.gif",
    sourcePath:
      ".tmp/media-validation/original/machine-chest-press/e99c366fb897571d.gif",
  },
  {
    exerciseSlug: "standing-chest-stretch",
    sourceTitle: "Chest stretch-CDC strength training for older adults.gif",
    sourcePath:
      ".tmp/media-validation/original/thoracic-extension/4055318b339d4591.gif",
  },
  {
    exerciseSlug: "seated-hamstring-stretch",
    sourceTitle: "Hamstring stretch-CDC strength training for older adults.gif",
    sourcePath:
      ".tmp/media-validation/original/thoracic-extension/a7c8eded2cdfbe7c.gif",
  },
  {
    exerciseSlug: "suitcase-carry",
    sourceTitle: "Kettlebell Farmer Walks.webm",
    sourcePath:
      ".tmp/media-validation/original/farmer-walk/10a8bfbd07151982.webm",
  },
] as const;

type ValidationCandidate = {
  sourceTitle: string;
  originalFileUrl: string;
  license: {
    code: string;
    url: string;
    author: string | null;
    sourceUrl: string;
    attributionRequired: boolean;
    attributionText: string;
    verified: boolean;
    issue: string | null;
  };
  technicalEvidence: {
    download: { sha256: string };
  };
};
type Validation = { version: string; candidates: ValidationCandidate[] };

const validation = JSON.parse(
  await readFile(VALIDATION_PATH, "utf8"),
) as Validation;
await mkdir(REVIEW_DIRECTORY, { recursive: true });
const reviewed = [];
for (const target of targets) {
  const source = validation.candidates.find(
    (candidate) => candidate.sourceTitle === target.sourceTitle,
  );
  if (!source?.license.verified || source.license.issue)
    throw new Error(`${target.exerciseSlug}: proveniencia/licenca invalida`);
  const sourcePath = path.resolve(target.sourcePath);
  const sourceSha256 = await sha256File(sourcePath);
  if (sourceSha256 !== source.technicalEvidence.download.sha256)
    throw new Error(`${target.exerciseSlug}: hash local divergente`);
  const sourceMetadata = await probeMedia(sourcePath);
  const contactSheetPath = path.join(
    REVIEW_DIRECTORY,
    `${target.exerciseSlug}.webp`,
  );
  await generateContactSheet(
    sourcePath,
    contactSheetPath,
    sourceMetadata.durationSeconds,
  );
  reviewed.push({
    exerciseSlug: target.exerciseSlug,
    sourceTitle: target.sourceTitle,
    sourceUrl: source.license.sourceUrl,
    originalFileUrl: source.originalFileUrl,
    author: source.license.author,
    licenseCode: source.license.code,
    licenseUrl: source.license.url,
    attributionRequired: source.license.attributionRequired,
    attributionText: source.license.attributionText,
    sourceSha256,
    sourceMetadata,
    localSource: target.sourcePath,
    contactSheet: path
      .relative(process.cwd(), contactSheetPath)
      .replaceAll("\\", "/"),
    visualDecision: "PENDING",
    visualNotes: null,
  });
}
await writeFile(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      version: "2.1-local-review",
      derivedFrom: validation.version,
      projectRef: "inghftngeritrsezwxnm",
      remoteWrites: 0,
      candidates: reviewed,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(`V21 local review: ${reviewed.length}/${targets.length}; zero writes remotos.`);
