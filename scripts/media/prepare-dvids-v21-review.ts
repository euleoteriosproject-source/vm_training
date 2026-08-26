import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateContactSheet, probeMedia } from "../../lib/media/ffmpeg.ts";
import { sha256File } from "../../lib/media/hash.ts";

const input = path.resolve("data/media/media-v21-dvids-discovery.json");
const output = path.resolve("data/media/media-v21-dvids-review.json");
const sourceDirectory = path.resolve(".tmp/media-v21/dvids-sources");
const reviewDirectory = path.resolve(".tmp/media-v21/dvids-contact-sheets");

type Candidate = {
  exerciseSlug: string;
  pageUrl: string;
  title: string;
  author: string | null;
  description: string;
  originalFileUrls: string[];
  publicDomainNoticePresent: boolean;
};
type Discovery = { version: string; candidates: Candidate[] };

const discovery = JSON.parse(await readFile(input, "utf8")) as Discovery;
if (discovery.version !== "2.1-dvids-discovery")
  throw new Error("Dataset DVIDS v2.1 invalido");
await Promise.all([
  mkdir(sourceDirectory, { recursive: true }),
  mkdir(reviewDirectory, { recursive: true }),
]);

const reviewed = [];
for (const candidate of discovery.candidates) {
  const originalFileUrl = candidate.originalFileUrls[0];
  const url = new URL(originalFileUrl);
  if (
    !candidate.author ||
    !candidate.publicDomainNoticePresent ||
    url.protocol !== "https:" ||
    url.hostname !== "d34w7g4gy10iej.cloudfront.net"
  )
    throw new Error(`${candidate.exerciseSlug}: origem DVIDS invalida`);
  const sourcePath = path.join(sourceDirectory, `${candidate.exerciseSlug}.mp4`);
  try {
    await probeMedia(sourcePath);
  } catch {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(60_000),
      headers: { "user-agent": "VMTrainingMediaReview/2.1" },
    });
    if (!response.ok)
      throw new Error(`${candidate.exerciseSlug}: HTTP ${response.status}`);
    await writeFile(sourcePath, Buffer.from(await response.arrayBuffer()));
  }
  const sourceMetadata = await probeMedia(sourcePath);
  const contactSheetPath = path.join(
    reviewDirectory,
    `${candidate.exerciseSlug}.webp`,
  );
  await generateContactSheet(
    sourcePath,
    contactSheetPath,
    sourceMetadata.durationSeconds,
  );
  reviewed.push({
    ...candidate,
    sourceName: "Defense Visual Information Distribution Service",
    sourceType: "public_domain",
    originalFileUrl,
    licenseCode: "PD",
    licenseUrl: "https://www.dvidshub.net/about/copyright",
    attributionRequired: false,
    author: candidate.author,
    attributionText: `${candidate.title}. Autor: ${candidate.author ?? "não identificado"}. Fonte: DVIDS. Domínio público dos Estados Unidos.`,
    sourceSha256: await sha256File(sourcePath),
    sourceMetadata,
    localSource: path.relative(process.cwd(), sourcePath).replaceAll("\\", "/"),
    contactSheet: path
      .relative(process.cwd(), contactSheetPath)
      .replaceAll("\\", "/"),
    visualDecision: "PENDING",
    visualNotes: null,
  });
  console.log(
    `${candidate.exerciseSlug}: ${sourceMetadata.width}x${sourceMetadata.height}, ${sourceMetadata.durationSeconds}s`,
  );
}
await writeFile(
  output,
  `${JSON.stringify(
    {
      version: "2.1-dvids-review",
      projectRef: "inghftngeritrsezwxnm",
      remoteWrites: 0,
      candidates: reviewed,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(`DVIDS review: ${reviewed.length}/${reviewed.length}; zero writes remotos.`);
