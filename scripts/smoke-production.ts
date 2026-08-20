export {};

try {
  process.loadEnvFile?.(".env.local");
} catch {
  /* Environment variables may be provided by CI. */
}

const rawUrl = process.env.PRODUCTION_URL;
if (!rawUrl) throw new Error("Configure PRODUCTION_URL");
const appOrigin = new URL(rawUrl).origin;

async function read(pathname: string) {
  const response = await fetch(`${appOrigin}${pathname}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${pathname}: HTTP ${response.status}`);
  if (/sign in to vercel|vercel authentication/i.test(text))
    throw new Error(`${pathname}: Vercel Authentication detectada`);
  return { response, text };
}

const login = await read("/login");
if (!/VM[\s\S]*Training/i.test(login.text) || !/E-mail/i.test(login.text))
  throw new Error("A rota de login não exibe a autenticação do VM Training");
const health = await read("/api/health");
const payload = JSON.parse(health.text) as { status?: string; app?: string };
if (payload.status !== "ok" || payload.app !== "vm-training")
  throw new Error("Health endpoint retornou payload inválido");

process.stdout.write(
  `Production smoke: PASS\nURL: ${appOrigin}\nLogin: HTTP ${login.response.status}\nHealth: HTTP ${health.response.status}\nVercel Authentication: absent\n`,
);
