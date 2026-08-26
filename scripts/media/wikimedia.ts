import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildAttribution, resolveLicense } from "../../lib/media/licenses.ts";
import { scoreMediaMatch } from "../../lib/media/matching.ts";
import { buildExerciseSearchQueries } from "../../lib/media/search-queries.ts";
import type { MatchExercise } from "../../lib/media/types.ts";

type ExtValue = { value?: string };
export type WikiPage = {
  pageid?: number;
  title: string;
  categoryinfo?: { size?: number };
  categories?: { title: string }[];
  imageinfo?: {
    url: string;
    descriptionurl: string;
    mime: string;
    size: number;
    width: number;
    height: number;
    extmetadata?: Record<string, ExtValue>;
  }[];
};
type CachedValue = { storedAt: number; value: unknown };
const cacheFile = path.resolve(".tmp/media-discovery-cache.json");
const ttl =
  Number(process.env.MEDIA_DISCOVERY_CACHE_TTL_HOURS ?? 24) * 60 * 60 * 1000;
let cachePromise: Promise<Record<string, CachedValue>> | undefined;
let cacheDirty = false;
const strip = (value: unknown = "") =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

async function cache() {
  cachePromise ??= readFile(cacheFile, "utf8")
    .then((value) => JSON.parse(value) as Record<string, CachedValue>)
    .catch(() => ({}));
  return cachePromise;
}
export async function flushWikimediaCache() {
  if (!cacheDirty) return;
  await mkdir(path.dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, JSON.stringify(await cache()), "utf8");
  cacheDirty = false;
}
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const apiConcurrency = Number(process.env.MEDIA_DISCOVERY_CONCURRENCY ?? 4);
let activeRequests = 0;
const requestWaiters: Array<() => void> = [];
let nextRequestStart = 0;
async function acquireRequestSlot() {
  if (activeRequests >= apiConcurrency)
    await new Promise<void>((resolve) => requestWaiters.push(resolve));
  activeRequests++;
  const wait = Math.max(0, nextRequestStart - Date.now());
  nextRequestStart = Math.max(Date.now(), nextRequestStart) + 300;
  if (wait) await delay(wait);
}
function releaseRequestSlot() {
  activeRequests--;
  requestWaiters.shift()?.();
}
async function api(params: URLSearchParams) {
  params.set("format", "json");
  params.set("origin", "*");
  const url = `https://commons.wikimedia.org/w/api.php?${params}`;
  const current = await cache(),
    cached = current[url];
  if (cached && Date.now() - cached.storedAt < ttl)
    return cached.value as Record<string, unknown>;
  for (let attempt = 0; attempt < 5; attempt++) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 20_000);
    await acquireRequestSlot();
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent":
            "VMTrainingMediaDiscovery/1.2 (license-review; contact: local-admin)",
        },
      });
      if (!response.ok) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        if (response.status === 429 && retryAfter)
          await delay(retryAfter * 1000);
        throw new Error(`Wikimedia API ${response.status}`);
      }
      const value = (await response.json()) as Record<string, unknown>;
      current[url] = { storedAt: Date.now(), value };
      cacheDirty = true;
      return value;
    } catch (error) {
      if (attempt === 4) throw error;
      await delay(1000 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
      releaseRequestSlot();
    }
  }
  throw new Error("Wikimedia API indisponível");
}
async function mapLimit<T, R>(
  values: T[],
  limit: number,
  run: (value: T) => Promise<R>,
) {
  const results: R[] = new Array(values.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor++;
        results[index] = await run(values[index]);
      }
    }),
  );
  return results;
}
function pagesFrom(payload: Record<string, unknown>) {
  const query = payload.query as
    { pages?: Record<string, WikiPage> } | undefined;
  return Object.values(query?.pages ?? {});
}
export function deduplicateWikiPages(pages: WikiPage[]) {
  return [...new Map(pages.map((page) => [page.title, page])).values()];
}
async function search(query: string) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: String(Number(process.env.MAX_RESULTS_PER_QUERY ?? 15)),
    gsrsearch: query,
    prop: "imageinfo|categories",
    iiprop: "url|mime|size|extmetadata",
    cllimit: "50",
  });
  return pagesFrom(await api(params));
}
export async function pagesByTitles(titles: string[]) {
  if (!titles.length) return [];
  const batches: string[][] = [];
  for (let index = 0; index < titles.length; index += 50)
    batches.push(titles.slice(index, index + 50));
  return (
    await mapLimit(batches, 3, async (batch) =>
      pagesFrom(
        await api(
          new URLSearchParams({
            action: "query",
            titles: batch.join("|"),
            prop: "imageinfo|categories",
            iiprop: "url|mime|size|extmetadata",
            cllimit: "50",
          }),
        ),
      ),
    )
  ).flat();
}

export const verifiedCategoryNames = [
  "Videos of people demonstrating strength training exercises",
  "CDC videos about physical activity",
  "Weight training",
  "Physical exercise",
];
export async function discoverFromCategories(
  names = verifiedCategoryNames,
  depth = Number(process.env.CATEGORY_DEPTH ?? 2),
  maxItems = Number(process.env.MAX_CATEGORY_ITEMS ?? 250),
) {
  const queue = names.map((name) => ({ name, depth: 0 })),
    visited = new Set<string>(),
    titles = new Set<string>(),
    verified: string[] = [];
  while (queue.length && titles.size < maxItems) {
    const item = queue.shift()!;
    if (visited.has(item.name)) continue;
    visited.add(item.name);
    const categoryPage = pagesFrom(
      await api(
        new URLSearchParams({
          action: "query",
          titles: `Category:${item.name}`,
          prop: "categoryinfo",
        }),
      ),
    )[0];
    if (!categoryPage?.categoryinfo) continue;
    if (item.depth === 0) verified.push(item.name);
    const payload = await api(
      new URLSearchParams({
        action: "query",
        list: "categorymembers",
        cmtitle: `Category:${item.name}`,
        cmtype: item.depth < depth ? "file|subcat" : "file",
        cmlimit: String(Math.min(100, maxItems - titles.size)),
      }),
    );
    const members =
      (
        payload.query as
          { categorymembers?: { title: string; ns: number }[] } | undefined
      )?.categorymembers ?? [];
    for (const member of members) {
      if (member.ns === 6) titles.add(member.title);
      else if (member.ns === 14 && item.depth < depth)
        queue.push({
          name: member.title.replace(/^Category:/, ""),
          depth: item.depth + 1,
        });
      if (titles.size >= maxItems) break;
    }
  }
  return {
    pages: await pagesByTitles([...titles]),
    verifiedCategories: verified,
  };
}

export async function discoverCdcExerciseMedia() {
  const queries = [
    "Muscle Strengthening at the Gym",
    "CDC exercise demonstration",
    "CDC strength training",
    "CDC physical activity exercise",
  ];
  const pages = (await mapLimit(queries, 3, search)).flat();
  return deduplicateWikiPages(pages);
}

export type WikimediaCandidate = {
  exercise: MatchExercise;
  title: string;
  description: string;
  categories: string[];
  sourceUrl: string;
  originalFileUrl: string;
  mime: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  durationSeconds: number | null;
  date: string | null;
  license: NonNullable<ReturnType<typeof resolveLicense>>;
  author: string | null;
  attributionText: string;
  match: ReturnType<typeof scoreMediaMatch>;
  rawMetadata: Record<string, string>;
};
export type DiscoveryResult = {
  queries: string[];
  resultsAnalyzed: number;
  mediaResults: number;
  licensedResults: number;
  rejectedLicenses: number;
  candidates: WikimediaCandidate[];
  missingReason: string | null;
  verifiedCategories: string[];
};

let categoryPromise: ReturnType<typeof discoverFromCategories> | undefined;
let cdcPromise: ReturnType<typeof discoverCdcExerciseMedia> | undefined;
export async function discoverWikimedia(
  exercise: MatchExercise,
  limit = 5,
): Promise<DiscoveryResult> {
  const queries = buildExerciseSearchQueries(exercise);
  const [searchPages, categoryResult, cdcPages] = await Promise.all([
    mapLimit(
      queries,
      Number(process.env.MEDIA_DISCOVERY_CONCURRENCY ?? 4),
      search,
    ).then((sets) => sets.flat()),
    (categoryPromise ??= discoverFromCategories()),
    (cdcPromise ??= discoverCdcExerciseMedia()),
  ]);
  const pages = deduplicateWikiPages([
    ...searchPages,
    ...categoryResult.pages,
    ...cdcPages,
  ]);
  const candidates: WikimediaCandidate[] = [];
  let mediaResults = 0,
    licensedResults = 0,
    rejectedLicenses = 0;
  const scored: ReturnType<typeof scoreMediaMatch>[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info || !["video/webm", "video/mp4", "image/gif"].includes(info.mime))
      continue;
    mediaResults++;
    const meta = Object.fromEntries(
      Object.entries(info.extmetadata ?? {}).map(([key, item]) => [
        key,
        strip(item.value),
      ]),
    );
    const license = resolveLicense(
      meta.LicenseShortName ?? "",
      meta.LicenseUrl ?? "",
    );
    if (!license) {
      rejectedLicenses++;
      continue;
    }
    licensedResults++;
    const description = meta.ImageDescription ?? meta.ObjectName ?? "";
    const categories =
      page.categories?.map((item) => item.title.replace(/^Category:/, "")) ??
      [];
    const match = scoreMediaMatch(exercise, {
      title: page.title.replace(/^File:/, ""),
      description,
      categories,
      mime: info.mime,
      source: `${meta.Artist ?? ""} ${meta.Credit ?? ""}`,
    });
    scored.push(match);
    if (!match.eligible) continue;
    const author = meta.Artist || meta.Credit || null;
    candidates.push({
      exercise,
      title: page.title.replace(/^File:/, ""),
      description,
      categories,
      sourceUrl: info.descriptionurl,
      originalFileUrl: info.url,
      mime: info.mime,
      fileSizeBytes: info.size,
      width: info.width,
      height: info.height,
      durationSeconds: Number(meta.Duration) || null,
      date: meta.DateTimeOriginal || meta.DateTime || null,
      license,
      author,
      attributionText: buildAttribution({
        title: page.title.replace(/^File:/, ""),
        author,
        sourceName: "Wikimedia Commons",
        license,
      }),
      match,
      rawMetadata: meta,
    });
  }
  const unique = [
    ...new Map(
      candidates.map((item) => [item.originalFileUrl.split("?")[0], item]),
    ).values(),
  ]
    .sort(
      (a, b) =>
        b.match.score - a.match.score ||
        Number(b.mime !== "image/gif") - Number(a.mime !== "image/gif"),
    )
    .slice(0, limit);
  const bestRejected = scored.sort((a, b) => b.score - a.score)[0];
  const missingReason = unique.length
    ? null
    : pages.length === 0
      ? "no_results"
      : mediaResults === 0
        ? "no_video"
        : licensedResults === 0
          ? "no_licensed_results"
          : bestRejected?.negativeReasons.includes("wrong equipment")
            ? "wrong_equipment"
            : bestRejected?.negativeReasons.includes("ambiguous generic title")
              ? "ambiguous"
              : "low_match_score";
  return {
    queries,
    resultsAnalyzed: pages.length,
    mediaResults,
    licensedResults,
    rejectedLicenses,
    candidates: unique,
    missingReason,
    verifiedCategories: categoryResult.verifiedCategories,
  };
}
