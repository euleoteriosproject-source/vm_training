import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  generateContactSheet,
  probeMedia,
  processVideo,
} from "../../lib/media/ffmpeg.ts";

const outputDirectory = path.resolve(".tmp/media-v21/trim-review");
await mkdir(outputDirectory, { recursive: true });

const trims = [
  {
    slug: "bodyweight-half-squat",
    source:
      ".tmp/media-validation/original/hack-squat/72f6dc978f353ead.webm",
    start: 16,
    end: 28,
  },
  {
    slug: "knee-push-up",
    source: ".tmp/media-v21/sources/knee-push-up.webm",
    start: 52,
    end: 64,
  },
  {
    slug: "seated-dumbbell-overhead-press",
    source: ".tmp/media-v21/sources/seated-dumbbell-overhead-press.webm",
    start: 16,
    end: 28,
  },
  {
    slug: "alternating-superman",
    source: ".tmp/media-v21/sources/alternating-superman.webm",
    start: 18,
    end: 30,
  },
  {
    slug: "bilateral-superman",
    source: ".tmp/media-v21/sources/bilateral-superman.webm",
    start: 32,
    end: 44,
  },
  {
    slug: "suitcase-carry",
    source:
      ".tmp/media-validation/original/farmer-walk/10a8bfbd07151982.webm",
    start: 1,
    end: 11,
  },
  {
    slug: "high-to-low-plank",
    source: ".tmp/media-v21/dvids-sources/high-to-low-plank.mp4",
    start: 24,
    end: 30,
  },
  {
    slug: "side-plank",
    source: ".tmp/media-v21/dvids-sources/side-plank.mp4",
    start: 0,
    end: 11,
  },
  {
    slug: "standing-toe-raise",
    source: ".tmp/media-v21/sources/standing-toe-raise.webm",
    start: 7,
    end: 19,
  },
  {
    slug: "back-extension-machine",
    source: ".tmp/media-v21/sources/back-extension-machine.webm",
    start: 18,
    end: 30,
  },
  {
    slug: "burpee",
    source: ".tmp/media-v21/sources/burpee.webm",
    start: 0,
    end: 12,
  },
  {
    slug: "walking",
    source: ".tmp/media-v21/sources/walking.webm",
    start: 13,
    end: 19,
  },
  {
    slug: "sumo-deadlift",
    source: ".tmp/media-v21/sources/sumo-deadlift.webm",
    start: 2,
    end: 14,
  },
] as const;

for (const trim of trims) {
  const clip = path.join(outputDirectory, `${trim.slug}.mp4`);
  const contactSheet = path.join(outputDirectory, `${trim.slug}.webp`);
  await processVideo(path.resolve(trim.source), clip, {
    trimStart: trim.start,
    trimEnd: trim.end,
  });
  const metadata = await probeMedia(clip);
  await generateContactSheet(clip, contactSheet, metadata.durationSeconds);
  console.log(
    `${trim.slug}: ${trim.start}-${trim.end}s, ${metadata.durationSeconds}s`,
  );
}
