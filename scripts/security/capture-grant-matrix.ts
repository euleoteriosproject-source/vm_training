import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const target = process.argv.includes("--production") ? "production" : "local";
const projectRef = "inghftngeritrsezwxnm";
const outputOverride = process.argv
  .find((argument) => argument.startsWith("--output="))
  ?.slice("--output=".length);
const output =
  outputOverride ??
  (target === "production"
    ? "data/security/grant-matrix-production.json"
    : "data/security/grant-matrix-local.json");
const targetArgs =
  target === "production"
    ? ["--linked", "--project-ref", projectRef]
    : ["--local"];
const cliArgs = [
  "pnpm",
  "exec",
  "supabase",
  "db",
  "query",
  ...targetArgs,
  "--file",
  "scripts/security/grant-matrix.sql",
  "--output-format",
  "json",
];
const bundledCorepack = path.join(
  path.dirname(process.execPath),
  "node_modules",
  "corepack",
  "dist",
  "corepack.js",
);
const executable = existsSync(bundledCorepack) ? process.execPath : "corepack";
const args = existsSync(bundledCorepack)
  ? [bundledCorepack, ...cliArgs]
  : cliArgs;
const result = spawnSync(executable, args, {
  cwd: process.cwd(),
  encoding: "utf8",
});
if (result.status !== 0)
  throw new Error(
    `Grant matrix query failed for ${target}: ${result.error?.message ?? result.stderr?.trim() ?? "unknown error"}`,
  );
const envelope = JSON.parse(result.stdout) as {
  rows?: Array<{ grant_matrix?: Record<string, unknown[]> }>;
};
const matrix = envelope.rows?.[0]?.grant_matrix;
if (!matrix) throw new Error(`Grant matrix payload missing for ${target}`);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output,
  `${JSON.stringify(
    {
      version: "1.6.1-R3",
      target,
      projectRef: target === "production" ? projectRef : null,
      matrix,
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(`Grant matrix captured: ${target} -> ${output}\n`);
