export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      status: "ok",
      app: "vm-training",
      version: "1.4",
      release: "1.0.0",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
