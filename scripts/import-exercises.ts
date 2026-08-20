/** Imports metadata only. Media is deliberately never imported without license review. */
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
async function main() {
  const file = process.argv[2];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!file || !url || !key)
    throw new Error(
      "Usage: tsx scripts/import-exercises.ts catalog.json (with Supabase env vars)",
    );
  const rows = JSON.parse(await readFile(file, "utf8")) as Record<
    string,
    unknown
  >[];
  if (rows.some((row) => "media" in row || "media_url" in row))
    throw new Error(
      "Media import is blocked; review licenses and upload through Admin.",
    );
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supabase
    .from("exercises")
    .upsert(rows, { onConflict: "slug" });
  if (error) throw error;
  process.stdout.write(`Imported ${rows.length} metadata records.\n`);
}
void main();
