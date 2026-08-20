import {
  cleanupMediaWorkspace,
  createMediaWorkspace,
  generatePoster,
  probeMedia,
  processVideo,
} from "../../lib/media/ffmpeg.ts";
import path from "node:path";
import { copyFile } from "node:fs/promises";
import { log, parseArgs } from "./shared.ts";
const args = parseArgs();
if (!args.input || !args.output)
  throw new Error(
    "Uso: pnpm media:process --input video.webm --output main.mp4",
  );
const workspace = await createMediaWorkspace();
try {
  const video = path.join(workspace, "main.mp4"),
    poster = path.join(workspace, "poster.webp");
  await processVideo(path.resolve(args.input), video);
  await generatePoster(video, poster);
  await copyFile(video, path.resolve(args.output));
  await copyFile(
    poster,
    path.join(path.dirname(path.resolve(args.output)), "poster.webp"),
  );
  const meta = await probeMedia(video);
  log(
    "PROCESS",
    `${args.output}: ${meta.width}x${meta.height}, ${meta.durationSeconds.toFixed(1)}s, ${meta.fileSizeBytes} bytes`,
  );
} finally {
  await cleanupMediaWorkspace(workspace);
}
