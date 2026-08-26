import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveLicense } from "../../lib/media/licenses.ts";
import {
  flushWikimediaCache,
  pagesByTitles,
  type WikiPage,
} from "./wikimedia.ts";

const OUTPUT_PATH = path.resolve("data/media/media-v21-discovery.json");

const targets = [
  ["barbell-bench-press", "File:Bench press - exercise demonstration video.webm"],
  ["bent-over-barbell-row", "File:Bent-over row - exercise demonstration video.webm"],
  ["conventional-deadlift", "File:Deadlift - exercise demonstration video.webm"],
  ["pull-up", "File:Pull-ups - exercise demonstration video.webm"],
  ["standing-barbell-press", "File:Shoulder press - exercise demonstration video.webm"],
  ["barbell-back-squat", "File:Squat - exercise demonstration video.webm"],
  ["incline-barbell-press", "File:Incline press - exercise demonstration video.webm"],
  ["hanging-straight-leg-raise", "File:Leg raises - exercise demonstration video.webm"],
  ["hanging-knee-raise", "File:Hanging crunches - exercise demonstration video.webm"],
  ["knee-push-up", "File:Muscle Strengthening at Home - Push-ups.webm"],
  ["bodyweight-half-squat", "File:Muscle Strengthening at Home - Half squat.webm"],
  ["seated-dumbbell-overhead-press", "File:Muscle Strengthening at Home - Overhead Press.webm"],
  ["alternating-superman", "File:Muscle Strengthening at Home - Superman.webm"],
  ["bilateral-superman", "File:Muscle Strengthening at Home - Superman.webm"],
  ["standing-toe-raise", "File:Muscle Strengthening at Home - Toe Lift.webm"],
  ["back-extension-machine", "File:Muscle Strengthening at the Gym - Back Extension.webm"],
  ["burpee", "File:Burpee.webm"],
  ["walking", "File:Fit walking.webmhd.webm"],
  ["sumo-deadlift", "File:Peso Muerto sumo.webm"],
  ["suitcase-carry", "File:Kettlebell Farmer Walks.webm"],
] as const;

function plain(value: unknown = "") {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function metadata(page: WikiPage) {
  return Object.fromEntries(
    Object.entries(page.imageinfo?.[0]?.extmetadata ?? {}).map(([key, item]) => [
      key,
      plain(item.value),
    ]),
  );
}

const pages = await pagesByTitles(targets.map(([, title]) => title));
await flushWikimediaCache();
const byTitle = new Map(pages.map((page) => [page.title, page]));
const candidates = targets.map(([exerciseSlug, requestedTitle]) => {
  const page = byTitle.get(requestedTitle);
  const info = page?.imageinfo?.[0];
  const meta = page ? metadata(page) : {};
  const license = resolveLicense(
    meta.LicenseShortName ?? "",
    meta.LicenseUrl ?? "",
  );
  return {
    exerciseSlug,
    requestedTitle,
    found: Boolean(info),
    title: page?.title.replace(/^File:/, "") ?? null,
    sourceUrl: info?.descriptionurl ?? null,
    originalFileUrl: info?.url ?? null,
    mime: info?.mime ?? null,
    fileSizeBytes: info?.size ?? null,
    width: info?.width ?? null,
    height: info?.height ?? null,
    author: meta.Artist || meta.Credit || null,
    licenseCode: license?.code ?? null,
    licenseUrl: license?.url ?? meta.LicenseUrl ?? null,
    attributionRequired: license?.attributionRequired ?? null,
    description: meta.ImageDescription || meta.ObjectName || null,
    date: meta.DateTimeOriginal || meta.DateTime || null,
    rawLicenseName: meta.LicenseShortName || null,
  };
});

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      version: "2.1-discovery",
      source: "Wikimedia Commons API exact-title lookup",
      writeScope: "local-versioned-metadata-only",
      candidates,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const licensed = candidates.filter(
  (candidate) => candidate.found && candidate.licenseCode,
).length;
console.log(
  `V21 discovery: ${candidates.filter((candidate) => candidate.found).length}/${candidates.length} encontrados; ${licensed} com licenca reconhecida; zero writes remotos.`,
);
