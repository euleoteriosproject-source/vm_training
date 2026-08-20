import { mkdir, writeFile } from "node:fs/promises";
import { getAdminClient, log } from "./shared.ts";
const client = getAdminClient();
if (!client) throw new Error("Supabase não configurado");
const { data, error } = await client
  .from("exercise_media")
  .select(
    "media_role,source_name,author,license_code,license_url,source_url,storage_path,approved_at,exercise:exercises(name_pt)",
  )
  .eq("status", "approved")
  .order("exercise_id");
if (error) throw error;
const lines = [
  "# Generated Exercise Media Licenses",
  "",
  "Generated at: " + new Date().toISOString(),
  "",
  "Exercise | Role | Source | Author | License | License URL | Original URL | Processed asset | Approved at",
  "--- | --- | --- | --- | --- | --- | --- | --- | ---",
  ...(data ?? []).map((row) => {
    const exercise = row.exercise as unknown as { name_pt: string } | null;
    const safe = (value: unknown) =>
      String(value ?? "—").replaceAll("|", "\\|");
    return [
      exercise?.name_pt,
      row.media_role,
      row.source_name,
      row.author,
      row.license_code,
      row.license_url,
      row.source_url,
      row.storage_path,
      row.approved_at,
    ]
      .map(safe)
      .join(" | ");
  }),
  "",
];
await mkdir("docs", { recursive: true });
await writeFile("docs/generated-media-licenses.md", lines.join("\n"), "utf8");
log(
  "REPORT",
  `Geradas ${data?.length ?? 0} linhas em docs/generated-media-licenses.md`,
);
