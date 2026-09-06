import { getAdminClient } from "../media/shared.ts";

const PROJECT_REF = "inghftngeritrsezwxnm";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || new URL(url).hostname !== `${PROJECT_REF}.supabase.co`)
  throw new Error("Supabase project ref mismatch");

const client = getAdminClient()!;
const tables = [
  ["profiles", "profiles"],
  ["plans", "workout_plans"],
  ["exercises", "exercises"],
] as const;
const report: Record<string, unknown> = { projectRef: PROJECT_REF, readOnly: true };

for (const [key, table] of tables) {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`${key}: ${error.code ?? "query_failed"} ${error.message}`);
  report[key] = count;
}

const [activePlans, versions, users, bucket, metadataIncomplete, v220Plans] = await Promise.all([
  client.from("workout_plans").select("*", { count: "exact", head: true }).eq("status", "active"),
  client.from("workout_plans").select("generator_version"),
  client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  client.storage.getBucket("exercise-media"),
  client
    .from("exercises")
    .select("*", { count: "exact", head: true })
    .or("exercise_family.is.null,fatigue_profile.is.null,stability_profile.is.null"),
  client
    .from("workout_plans")
    .select("*", { count: "exact", head: true })
    .eq("generator_version", "v2.2.0"),
]);
for (const [name, result] of [
  ["activePlans", activePlans],
  ["versions", versions],
  ["users", users],
  ["bucket", bucket],
  ["metadataIncomplete", metadataIncomplete],
  ["v220Plans", v220Plans],
] as const)
  if (result.error)
    throw new Error(`${name}: ${"code" in result.error ? result.error.code : "query_failed"} ${result.error.message}`);

const versionRows = versions.data ?? [];
report.activePlans = activePlans.count;
report.authUsers = users.data.users.length;
report.bucketPrivate = bucket.data ? !bucket.data.public : false;
report.metadataIncomplete = metadataIncomplete.count;
report.v220Plans = v220Plans.count;
report.planVersions = Object.fromEntries(
  [...new Set(versionRows.map((row) => row.generator_version ?? "legacy"))]
    .sort()
    .map((version) => [
      version,
      versionRows.filter((row) => (row.generator_version ?? "legacy") === version).length,
    ]),
);

process.stdout.write(`${JSON.stringify(report)}\n`);
