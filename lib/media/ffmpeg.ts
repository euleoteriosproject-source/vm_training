import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

function executable(name: "ffmpeg" | "ffprobe") {
  if (name === "ffmpeg") return process.env.FFMPEG_PATH ?? "ffmpeg";
  if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;
  if (process.env.FFMPEG_PATH)
    return process.env.FFMPEG_PATH.replace(
      /ffmpeg(?:\.exe)?$/i,
      process.platform === "win32" ? "ffprobe.exe" : "ffprobe",
    );
  return "ffprobe";
}

function unavailable(command: string) {
  return new Error(
    `${command} não encontrado. Instale FFmpeg e configure FFMPEG_PATH/FFPROBE_PATH, ou adicione os binários ao PATH.`,
  );
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    let error = "";
    child.stderr.on("data", (chunk) => {
      error += String(chunk).slice(-4000);
    });
    child.on("error", (error: NodeJS.ErrnoException) =>
      reject(error.code === "ENOENT" ? unavailable(command) : error),
    );
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`FFmpeg falhou (${code}): ${error.slice(-1200)}`)),
    );
  });
}
function capture(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "",
      error = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      error += String(chunk).slice(-4000);
    });
    child.on("error", (error: NodeJS.ErrnoException) =>
      reject(error.code === "ENOENT" ? unavailable(command) : error),
    );
    child.on("close", (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`ffprobe falhou (${code}): ${error.slice(-1200)}`)),
    );
  });
}
export async function createMediaWorkspace() {
  const base = path.resolve(".tmp", "media-processing");
  await mkdir(base, { recursive: true });
  return mkdtemp(path.join(base, "job-"));
}
export async function cleanupMediaWorkspace(directory: string) {
  const resolved = path.resolve(directory);
  const base = `${path.resolve(".tmp", "media-processing")}${path.sep}`;
  if (!resolved.startsWith(base))
    throw new Error("Diretório temporário fora do escopo");
  await rm(resolved, { recursive: true, force: true });
}
export async function processVideo(
  input: string,
  output: string,
  options?: { trimStart?: number; trimEnd?: number },
) {
  const duration = options?.trimEnd
    ? options.trimEnd - (options.trimStart ?? 0)
    : 12;
  const args = [
    "-y",
    "-ss",
    String(options?.trimStart ?? 0),
    "-i",
    input,
    "-t",
    String(Math.min(12, duration)),
    "-vf",
    "scale='if(gt(iw,ih),min(1280,iw),min(720,iw))':'if(gt(iw,ih),min(720,ih),min(1280,ih))':force_original_aspect_ratio=decrease,fps=30,format=yuv420p",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "25",
    "-movflags",
    "+faststart",
    output,
  ];
  await run(executable("ffmpeg"), args);
}
export async function generatePoster(
  input: string,
  output: string,
  atSeconds = 2,
) {
  await run(executable("ffmpeg"), [
    "-y",
    "-ss",
    String(atSeconds),
    "-i",
    input,
    "-frames:v",
    "1",
    "-vf",
    "scale='if(gt(iw,ih),min(1280,iw),min(720,iw))':'if(gt(iw,ih),min(720,ih),min(1280,ih))':force_original_aspect_ratio=decrease",
    "-c:v",
    "libwebp",
    "-quality",
    "82",
    output,
  ]);
}
export async function probeMedia(input: string) {
  const raw = await capture(executable("ffprobe"), [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,r_frame_rate:format=duration,size",
    "-of",
    "json",
    input,
  ]);
  const value = JSON.parse(raw) as {
    streams?: { width: number; height: number; r_frame_rate: string }[];
    format?: { duration: string; size: string };
  };
  const stream = value.streams?.[0];
  return {
    width: stream?.width ?? 0,
    height: stream?.height ?? 0,
    durationSeconds: Number(value.format?.duration ?? 0),
    fileSizeBytes: Number(value.format?.size ?? 0),
  };
}

export async function checkFfmpeg() {
  const [ffmpegOutput, ffprobeOutput] = await Promise.all([
    capture(executable("ffmpeg"), ["-version"]),
    capture(executable("ffprobe"), ["-version"]),
  ]);
  return {
    ffmpeg: ffmpegOutput.split(/\r?\n/, 1)[0] ?? "ffmpeg",
    ffprobe: ffprobeOutput.split(/\r?\n/, 1)[0] ?? "ffprobe",
  };
}
