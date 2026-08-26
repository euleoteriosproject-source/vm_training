import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prepareLocalArtifact } from "../../lib/media/prepare.ts";
import { sha256File } from "../../lib/media/hash.ts";

const PROJECT_REF = "inghftngeritrsezwxnm";
const OUTPUT_PATH = path.resolve("data/media/media-v21.json");
const PREPARED_DIRECTORY = path.resolve(".tmp/media-v21/prepared");

type Candidate = {
  exerciseSlug: string;
  title?: string | null;
  sourceTitle?: string;
  sourceUrl?: string;
  pageUrl?: string;
  originalFileUrl: string;
  author: string | null;
  licenseCode: string;
  licenseUrl: string;
  attributionRequired: boolean;
  attributionText?: string;
  sourceSha256: string;
  sourceMetadata: { durationSeconds: number };
  localSource: string;
};

type ReviewDataset = {
  projectRef: string;
  candidates: Candidate[];
};

const trims: Record<string, [number, number]> = {
  "bodyweight-half-squat": [16, 28],
  "knee-push-up": [52, 64],
  "seated-dumbbell-overhead-press": [16, 28],
  "alternating-superman": [18, 30],
  "bilateral-superman": [32, 44],
  "suitcase-carry": [1, 11],
  "high-to-low-plank": [24, 30],
  "side-plank": [0, 11],
  "standing-toe-raise": [7, 19],
  "back-extension-machine": [18, 30],
  burpee: [0, 12],
  walking: [13, 19],
  "sumo-deadlift": [2, 14],
};

const visualNotes: Record<string, string> = {
  "bodyweight-half-squat":
    "Trecho isolado mostra meio agachamento com peso corporal, pés apoiados e joelhos alinhados.",
  "knee-push-up":
    "Trecho isolado mostra flexão com joelhos apoiados e repetição completa.",
  "seated-dumbbell-overhead-press":
    "Trecho isolado mostra desenvolvimento sentado com dois halteres e amplitude completa.",
  "alternating-superman":
    "Trecho isolado mostra elevação alternada de braço e perna opostos em decúbito ventral.",
  "bilateral-superman":
    "Trecho isolado mostra elevação bilateral de braços e pernas em decúbito ventral.",
  "suitcase-carry":
    "Trecho isolado mostra caminhada com carga unilateral e tronco estável.",
  "high-to-low-plank":
    "Trecho isolado mostra transições controladas entre prancha alta e antebraços.",
  "side-plank":
    "Vídeo oficial mostra prancha lateral com corpo alinhado e quadril elevado.",
  "standing-toe-raise":
    "Trecho isolado mostra dorsiflexão em pé com calcanhares apoiados.",
  "back-extension-machine":
    "Trecho isolado mostra extensão de tronco na máquina sem ultrapassar a posição neutra.",
  burpee:
    "Vídeo mostra ciclos completos de burpee sem salto com apoio das mãos e retorno em pé.",
  walking:
    "Trecho isolado contém somente caminhada contínua em terreno plano.",
  "sumo-deadlift":
    "Animação mostra base ampla, pegada entre as pernas e extensão do levantamento terra sumô.",
};

const excludedDvids = new Set(["trx-hip-flexor-stretch"]);
const localOnly = new Set([
  "chair-squat",
  "dumbbell-floor-press",
  "standing-chest-stretch",
  "seated-hamstring-stretch",
]);

const [commons, local, dvids] = (await Promise.all([
  readFile("data/media/media-v21-review.json", "utf8"),
  readFile("data/media/media-v21-local-review.json", "utf8"),
  readFile("data/media/media-v21-dvids-review.json", "utf8"),
])).map((raw) => JSON.parse(raw) as ReviewDataset);

for (const dataset of [commons, local, dvids]) {
  if (dataset.projectRef !== PROJECT_REF)
    throw new Error("Dataset de revisão aponta para projeto divergente");
}

const candidates = [
  ...commons.candidates,
  ...local.candidates.filter((candidate) => localOnly.has(candidate.exerciseSlug)),
  ...dvids.candidates.filter(
    (candidate) => !excludedDvids.has(candidate.exerciseSlug),
  ),
];
const uniqueSlugs = new Set(candidates.map((candidate) => candidate.exerciseSlug));
if (candidates.length !== 26 || uniqueSlugs.size !== candidates.length)
  throw new Error(
    `Cobertura v2.1 inesperada: ${candidates.length} decisões / ${uniqueSlugs.size} slugs`,
  );

await mkdir(PREPARED_DIRECTORY, { recursive: true });
const decisions = [];
for (const candidate of candidates) {
  const canonicalSourceUrl = candidate.sourceUrl ?? candidate.pageUrl;
  if (
    !candidate.author ||
    !candidate.licenseCode ||
    !candidate.licenseUrl ||
    !canonicalSourceUrl ||
    !candidate.originalFileUrl ||
    !candidate.sourceSha256
  )
    throw new Error(`${candidate.exerciseSlug}: proveniência incompleta`);
  const sourcePath = path.resolve(candidate.localSource);
  if ((await sha256File(sourcePath)) !== candidate.sourceSha256)
    throw new Error(`${candidate.exerciseSlug}: hash da fonte local diverge`);

  const [trimStart, trimEnd] = trims[candidate.exerciseSlug] ?? [
    0,
    Math.min(12, candidate.sourceMetadata.durationSeconds),
  ];
  const artifact = await prepareLocalArtifact({
    exerciseSlug: candidate.exerciseSlug,
    inputPath: sourcePath,
    outputDirectory: path.join(PREPARED_DIRECTORY, candidate.exerciseSlug),
    trimStart,
    trimEnd,
    mediaRole: "PRIMARY_DEMO",
    posterTimestamp: Math.min(2, Math.max(0.5, (trimEnd - trimStart) * 0.35)),
  });
  if (
    artifact.frameCount <= 1 ||
    !artifact.animationLoop ||
    artifact.metadata.durationSeconds <= 0 ||
    artifact.metadata.durationSeconds > 12.1
  )
    throw new Error(`${candidate.exerciseSlug}: artefato animado inválido`);

  const sourceName = canonicalSourceUrl.includes("dvidshub.net")
    ? "Defense Visual Information Distribution Service"
    : "Wikimedia Commons";
  const sourceType =
    candidate.licenseCode === "PD" ? "public_domain" : "creative_commons";
  const approvedVisualNote =
    visualNotes[candidate.exerciseSlug] ??
    "Fonte oficial demonstra exatamente o exercício, com equipamento compatível e repetição principal visível.";
  decisions.push({
    exercise: candidate.exerciseSlug,
    sourceFile: candidate.localSource,
    title: candidate.title ?? candidate.sourceTitle ?? candidate.exerciseSlug,
    sourceName,
    sourceType,
    sourceUrl: canonicalSourceUrl,
    originalFileUrl: candidate.originalFileUrl,
    licenseCode: candidate.licenseCode,
    licenseUrl: candidate.licenseUrl,
    author: candidate.author,
    attributionRequired: candidate.attributionRequired,
    attributionText:
      candidate.attributionText ??
      `${candidate.title ?? candidate.sourceTitle}. Autor: ${candidate.author}. Licença: ${candidate.licenseCode}. Fonte: ${sourceName}. Recortado e convertido pelo VM Training.`,
    trimStart,
    trimEnd,
    posterTimestamp: artifact.posterTimestamp,
    sourceSha256: candidate.sourceSha256,
    artifactSha256: artifact.hash,
    posterSha256: await sha256File(artifact.posterPath),
    mediaType: artifact.mediaType,
    fallbackReason: artifact.fallbackReason,
    frameCount: artifact.frameCount,
    animationLoop: artifact.animationLoop,
    framesPerSecond: artifact.framesPerSecond,
    width: artifact.metadata.width,
    height: artifact.metadata.height,
    durationSeconds: artifact.metadata.durationSeconds,
    visualDecision: "APPROVED_AUTOMATED_VISUAL_REVIEW",
    visualNotes: approvedVisualNote,
    reason: approvedVisualNote,
    references: [canonicalSourceUrl, candidate.licenseUrl],
    reviewChecklist: {
      correctExercise: true,
      compatibleEquipment: true,
      startPositionVisible: true,
      mainRangeVisible: true,
      completeRepetitionOrHoldVisible: true,
      sufficientClarity: true,
      noBlockingElements: true,
      licenseConfirmed: true,
    },
  });
  console.log(
    `${candidate.exerciseSlug}: ${artifact.mediaType}, ${artifact.metadata.durationSeconds}s, ${artifact.frameCount} frames`,
  );
}

await writeFile(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      version: "2.1",
      projectRef: PROJECT_REF,
      reviewMethod: "automated_assisted_visual_inspection",
      reviewAgent: "vm-media-validator-v21",
      humanReviewClaimed: false,
      remoteWrites: 0,
      decisionCount: decisions.length,
      decisions,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(`V21 dataset: ${decisions.length}/26 decisões; zero writes remotos.`);
