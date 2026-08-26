import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const queries = ["burpee", "jumping jacks", "mountain climber", "high knees"];
const results = [];
for (const query of queries) {
  const searchUrl = `https://www.dvidshub.net/search?q=${encodeURIComponent(query)}&type=video`;
  const response = await fetch(searchUrl, {
    signal: AbortSignal.timeout(20_000),
    headers: { "user-agent": "VMTrainingMediaDiscovery/2.1" },
  });
  if (!response.ok) throw new Error(`${query}: DVIDS HTTP ${response.status}`);
  const html = await response.text();
  const links = [
    ...new Set(
      [...html.matchAll(/href=["'](\/video\/\d+\/[a-z0-9-]+)["']/gi)].map(
        (match) => new URL(match[1], searchUrl).toString(),
      ),
    ),
  ].slice(0, 20);
  results.push({ query, searchUrl, resultCount: links.length, links });
}
const output = path.resolve("data/media/media-v21-dvids-cardio-search.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify(
    {
      version: "2.1-dvids-cardio-search",
      source: "DVIDS official search",
      writeScope: "local-versioned-metadata-only",
      results,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
console.log(
  `DVIDS cardio search: ${results.reduce((sum, item) => sum + item.resultCount, 0)} links; zero writes remotos.`,
);
