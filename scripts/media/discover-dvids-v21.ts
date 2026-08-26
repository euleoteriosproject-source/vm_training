import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const targets = [
  {
    exerciseSlug: "high-to-low-plank",
    pageUrl:
      "https://www.dvidshub.net/video/753559/7-foundational-movements-plank",
  },
  {
    exerciseSlug: "side-plank",
    pageUrl: "https://www.dvidshub.net/video/640254/side-plank",
  },
  {
    exerciseSlug: "trx-hip-flexor-stretch",
    pageUrl:
      "https://www.dvidshub.net/video/551157/trx-forward-lunge-with-hip-flexor-stretch",
  },
] as const;

function decode(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#x2F;", "/")
    .replaceAll("\\/", "/");
}

function plain(value: string) {
  return decode(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const candidates = [];
for (const target of targets) {
  const response = await fetch(target.pageUrl, {
    signal: AbortSignal.timeout(20_000),
    headers: { "user-agent": "VMTrainingMediaDiscovery/2.1" },
  });
  if (!response.ok)
    throw new Error(`${target.exerciseSlug}: DVIDS HTTP ${response.status}`);
  const html = await response.text();
  const pageText = plain(html);
  const structuredData = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )]
    .map((match) => {
      try {
        return JSON.parse(match[1]) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((value): value is Record<string, unknown> => Boolean(value));
  const authored = structuredData.find((value) => value.author || value.creator);
  const rawAuthor = authored?.author ?? authored?.creator;
  const structuredAuthor = Array.isArray(rawAuthor)
    ? rawAuthor
        .map((value) =>
          typeof value === "string"
            ? value
            : ((value as { name?: string })?.name ?? null),
        )
        .filter(Boolean)
        .join(", ")
    : typeof rawAuthor === "string"
      ? rawAuthor
      : ((rawAuthor as { name?: string } | undefined)?.name ?? null);
  const author =
    structuredAuthor ??
    pageText.match(/Video by\s+([^&"<]{2,100})/i)?.[1]?.trim() ??
    null;
  const creditEvidence = [
    ...new Set(
      [...pageText.matchAll(/(?:Video by|Photo by|Author|Credit)[:\s]+.{0,140}/gi)]
        .map((match) => match[0].replace(/\s+/g, " ").trim())
        .filter((value) => value.length < 180),
    ),
  ].slice(0, 8);
  const urls = [
    ...new Set(
      [...html.matchAll(/https:\/\/[^"'<>\s]+/g)]
        .map((match) => decode(match[0]))
        .filter(
          (url) =>
            /cloudfront\.net/i.test(url) &&
            /\.(?:mp4|webm)(?:\?|$)/i.test(url),
        ),
    ),
  ];
  const description =
    html.match(
      /<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["']([^"']+)/i,
    )?.[1] ?? null;
  const title =
    html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)/i)?.[1] ??
    html.match(/<title>([^<]+)/i)?.[1] ??
    null;
  candidates.push({
    ...target,
    title: title ? decode(title).trim() : null,
    author,
    creditEvidence,
    description: description ? decode(description).trim() : null,
    originalFileUrls: urls,
    publicDomainNoticePresent: /PUBLIC DOMAIN/i.test(html),
    pageBytes: Buffer.byteLength(html),
  });
}

const output = path.resolve("data/media/media-v21-dvids-discovery.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify(
    {
      version: "2.1-dvids-discovery",
      source: "DVIDS official asset pages",
      writeScope: "local-versioned-metadata-only",
      candidates,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(
  `DVIDS discovery: ${candidates.length} pages; ${candidates.reduce((sum, item) => sum + item.originalFileUrls.length, 0)} arquivos; zero writes remotos.`,
);
