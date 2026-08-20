import { spawn } from "node:child_process";
import path from "node:path";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  /* Environment variables may be provided by CI. */
}

const modeArg = process.argv.indexOf("--mode");
const mode = modeArg >= 0 ? process.argv[modeArg + 1] : "local";
if (!(["local", "production"] as const).includes(mode as "local" | "production"))
  throw new Error("Use --mode local ou --mode production");

function assertProductionConfiguration() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "NEXT_PUBLIC_APP_URL",
    "PRODUCTION_URL",
    "E2E_TEST_EMAIL",
    "E2E_TEST_PASSWORD",
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length)
    throw new Error(`Production env ausente: ${missing.join(", ")}`);
  const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  const app = new URL(process.env.NEXT_PUBLIC_APP_URL!);
  if (!supabase.hostname.endsWith(".supabase.co"))
    throw new Error("Production exige Supabase Hosted (*.supabase.co)");
  if (app.protocol !== "https:")
    throw new Error("NEXT_PUBLIC_APP_URL de Production deve usar HTTPS");
  if (process.env.SUPABASE_AUTH_HOOK_VERIFIED !== "true")
    throw new Error("Confirme o Before User Created Hook com SUPABASE_AUTH_HOOK_VERIFIED=true");
  if (process.env.E2E_MEDIA_TEST !== "true")
    throw new Error("Production exige E2E_MEDIA_TEST=true e Media E2E sem skip");
}

if (mode === "production") assertProductionConfiguration();

const common: Array<[string, string[]]> = [
  ["pnpm", ["lint"]],
  ["pnpm", ["typecheck"]],
  ["pnpm", ["test"]],
  ["pnpm", ["exec", "supabase", "test", "db"]],
  ["pnpm", ["test:e2e"]],
  ["pnpm", ["media:validate"]],
  ["pnpm", ["media:storage-check"]],
  ["pnpm", ["build"]],
];
const commands: Array<[string, string[]]> =
  mode === "production"
    ? [
        ...common,
        ["pnpm", ["media:production-report", "--release"]],
        ["pnpm", ["release:report", "--mode", "production"]],
        ["pnpm", ["smoke:production"]],
      ]
    : [
        ...common,
        ["pnpm", ["media:production-report"]],
        ["pnpm", ["release:report", "--mode", "local"]],
      ];

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const useCorepack = command === "pnpm";
    const windowsCorepack = path.join(
      path.dirname(process.execPath),
      "node_modules",
      "corepack",
      "dist",
      "corepack.js",
    );
    const executable =
      useCorepack && process.platform === "win32"
        ? process.execPath
        : useCorepack
          ? "corepack"
          : command;
    const childArgs =
      useCorepack && process.platform === "win32"
        ? [windowsCorepack, "pnpm", ...args]
        : useCorepack
          ? ["pnpm", ...args]
          : args;
    const child = spawn(executable, childArgs, {
      stdio: "inherit",
      windowsHide: true,
      shell: false,
      env: { ...process.env, RELEASE_CHECK_MODE: mode },
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} ${args.join(" ")} falhou (${code})`)),
    );
  });
}

process.stdout.write(`VM Training release check — ${mode.toUpperCase()}\n`);
for (const [command, args] of commands) {
  process.stdout.write(`\n[release:check] ${command} ${args.join(" ")}\n`);
  await run(command, args);
}
process.stdout.write(`\n${mode.toUpperCase()} release checks passed\n`);
