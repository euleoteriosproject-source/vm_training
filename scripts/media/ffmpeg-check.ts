import { checkFfmpeg } from "../../lib/media/ffmpeg.ts";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  /* Optional local environment. */
}

try {
  const result = await checkFfmpeg();
  process.stdout.write(
    `FFmpeg found\nVersion: ${result.ffmpeg}\nffprobe found\nVersion: ${result.ffprobe}\nReady\n`,
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n` +
      "Windows: instale com `winget install Gyan.FFmpeg` e abra um novo terminal.\n",
  );
  process.exitCode = 1;
}
