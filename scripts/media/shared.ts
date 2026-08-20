import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fallbackCatalog } from "./catalog.ts";
import type { MatchExercise } from "../../lib/media/types.ts";
import { expandedAliases } from "../../lib/media/search-queries.ts";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  /* Optional local environment. */
}

export type CliArgs = {
  dryRun: boolean;
  exercise?: string;
  source?: string;
  limit: number;
  id?: string;
  mediaId?: string;
  input?: string;
  output?: string;
  manifest?: string;
  licenseFile?: string;
  confirmWebRedistribution: boolean;
  missingOnly: boolean;
  force: boolean;
  expanded: boolean;
  resume: boolean;
  approvedForProcessing: boolean;
  apply: boolean;
  allowProduction: boolean;
};
export function parseArgs(argv = process.argv.slice(2)): CliArgs {
  const value = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    dryRun: argv.includes("--dry-run"),
    exercise: value("--exercise"),
    source: value("--source"),
    limit: Number(value("--limit") ?? 3),
    id: value("--id"),
    mediaId: value("--media-id"),
    input: value("--input"),
    output: value("--output"),
    manifest: value("--manifest"),
    licenseFile: value("--license-file"),
    confirmWebRedistribution: argv.includes("--confirm-web-redistribution"),
    missingOnly: argv.includes("--missing-only"),
    force: argv.includes("--force"),
    expanded: argv.includes("--expanded"),
    resume: argv.includes("--resume"),
    approvedForProcessing: argv.includes("--approved-for-processing"),
    apply: argv.includes("--apply"),
    allowProduction: argv.includes("--allow-production"),
  };
}
export function getAdminClient(required = true): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    if (required)
      throw new Error(
        "Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY",
      );
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function loadExercises(
  client: SupabaseClient | null,
): Promise<MatchExercise[]> {
  if (!client)
    return fallbackCatalog.map((item, index) => ({
      ...item,
      id: `local-${index}`,
      aliases: [
        ...new Set([...item.aliases, ...(expandedAliases[item.slug] ?? [])]),
      ],
    }));
  const { data, error } = await client
    .from("exercises")
    .select(
      "id,slug,name_pt,name_en,category,movement_pattern,primary_muscles,exercise_aliases(alias),exercise_equipment(equipment(name,slug))",
    )
    .order("name_pt");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    namePt: row.name_pt,
    nameEn: row.name_en,
    movementPattern: row.movement_pattern,
    muscles: row.primary_muscles ?? [],
    aliases: [
      ...(row.exercise_aliases ?? []).map(
        (entry: { alias: string }) => entry.alias,
      ),
      ...(expandedAliases[row.slug] ?? []),
    ].filter((value, index, values) => values.indexOf(value) === index),
    category: row.category,
    equipment: (row.exercise_equipment ?? []).flatMap(
      (entry: {
        equipment:
          | { name: string; slug: string }
          | { name: string; slug: string }[]
          | null;
      }) => {
        const relation = entry.equipment;
        return Array.isArray(relation)
          ? relation.flatMap((item) => [item.name, item.slug])
          : relation
            ? [relation.name, relation.slug]
            : [];
      },
    ),
  }));
}
export function log(stage: string, message: string) {
  process.stdout.write(`[${stage}] ${message}\n`);
}
