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

function assertHtmlPage(
  pathname: string,
  result: Awaited<ReturnType<typeof read>>,
) {
  const contentType = result.response.headers.get("content-type") ?? "";
  const finalPath = new URL(result.response.url).pathname;
  if (!contentType.toLowerCase().includes("text/html"))
    throw new Error(`${pathname}: resposta não é HTML`);
  if (finalPath !== pathname)
    throw new Error(`${pathname}: redirecionou para rota inesperada`);
  if (!/<title>VM Training<\/title>/i.test(result.text))
    throw new Error(`${pathname}: shell do VM Training ausente`);
}

const [landing, login, signup] = await Promise.all([
  read("/"),
  read("/login"),
  read("/sign-up"),
]);
assertHtmlPage("/", landing);
assertHtmlPage("/login", login);
assertHtmlPage("/sign-up", signup);
const health = await read("/api/health");
const payload = JSON.parse(health.text) as { status?: string; app?: string };
if (payload.status !== "ok" || payload.app !== "vm-training")
  throw new Error("Health endpoint retornou payload inválido");

process.stdout.write(
  `Production smoke: PASS\nURL: ${appOrigin}\nLogin: HTTP ${login.response.status}\nHealth: HTTP ${health.response.status}\nVercel Authentication: absent\n`,
);
