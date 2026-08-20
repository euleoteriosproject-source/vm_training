import { calculatePlanCoverage } from "../../lib/media/operations.ts";
import { getAdminClient } from "./shared.ts";

const client = getAdminClient()!;
const [
  { data: exercises, error: exerciseError },
  { data: plans, error: planError },
  { data: profiles, error: profileError },
] = await Promise.all([
  client
    .from("exercises")
    .select(
      "id,slug,name_pt,exercise_media(id,status,media_role,execution_quality,is_primary,source_name,license_code,storage_path)",
    )
    .order("name_pt"),
  client
    .from("workout_plans")
    .select(
      "id,name,status,user_id,workout_days(workout_day_exercises(exercise_id))",
    )
    .in("status", ["active", "draft"]),
  client.from("profiles").select("user_id,email,display_name"),
]);
if (exerciseError) throw exerciseError;
if (planError) throw planError;
if (profileError) throw profileError;
const profilesById = new Map(
  (profiles ?? []).map((profile) => [profile.user_id, profile]),
);

const allMedia = (exercises ?? []).flatMap((exercise) =>
  (exercise.exercise_media ?? []).map((media) => ({
    ...media,
    exerciseId: exercise.id,
    exerciseName: exercise.name_pt,
    exerciseSlug: exercise.slug,
  })),
);
const approved = allMedia.filter(
  (media) =>
    media.status === "approved" && media.execution_quality === "approved",
);
const approvedPrimary = approved.filter(
  (media) => media.media_role === "PRIMARY_DEMO" && media.is_primary,
);
const educational = approved.filter(
  (media) => media.media_role === "EDUCATIONAL",
);
const variations = approved.filter(
  (media) => media.media_role === "ALTERNATIVE_VARIATION",
);
const pending = allMedia.filter((media) =>
  ["pending", "reviewing", "processing", "processed", "failed"].includes(
    media.status,
  ),
);
const coveredIds = new Set(approvedPrimary.map((media) => media.exerciseId));
const missing = (exercises ?? []).filter(
  (exercise) => !coveredIds.has(exercise.id),
);
const catalogCoverage =
  (exercises?.length ?? 0) === 0
    ? 100
    : Number(((coveredIds.size / exercises!.length) * 100).toFixed(1));

process.stdout.write(
  `VM Training Media Production\n\n` +
    `Total exercises:              ${exercises?.length ?? 0}\n` +
    `Primary approved:             ${approvedPrimary.length}\n` +
    `Educational approved:         ${educational.length}\n` +
    `Variation approved:           ${variations.length}\n` +
    `Pending review:               ${pending.length}\n` +
    `Missing:                      ${missing.length}\n\n` +
    `Catalog primary coverage:     ${catalogCoverage.toFixed(1)}%\n\n`,
);

let releaseBlocked = false;
if (!plans?.length) {
  process.stdout.write(
    "Plan Coverage\nNo active plan — onboarding required\n\n",
  );
} else {
  process.stdout.write("Plan Coverage\n");
  for (const plan of plans) {
    const ids = (plan.workout_days ?? []).flatMap((day) =>
      (day.workout_day_exercises ?? []).map((row) => row.exercise_id),
    );
    const coverage = calculatePlanCoverage(ids, coveredIds);
    const owner = profilesById.get(plan.user_id);
    process.stdout.write(
      `${owner?.display_name ?? owner?.email ?? "User"} — ${plan.name} [${plan.status}]: ` +
        `${coverage.primaryApproved}/${coverage.exercises} (${coverage.percentage.toFixed(1)}%)\n`,
    );
    if (plan.status === "active" && coverage.percentage < 100)
      releaseBlocked = true;
  }
  process.stdout.write("\n");
}

process.stdout.write(
  "Exercise | Role | Source | License | Review | Processing | Storage | Status | Used by plan\n" +
    "--- | --- | --- | --- | --- | --- | --- | --- | ---\n" +
    allMedia
      .map((media) => {
        const used = (plans ?? []).some((plan) =>
          (plan.workout_days ?? []).some((day) =>
            (day.workout_day_exercises ?? []).some(
              (row) => row.exercise_id === media.exerciseId,
            ),
          ),
        );
        return `${media.exerciseName} | ${media.media_role ?? "UNCLASSIFIED"} | ${media.source_name ?? "—"} | ${media.license_code ?? "—"} | ${media.execution_quality} | ${media.status} | ${media.storage_path ? "stored" : "not stored"} | ${media.status} | ${used ? "yes" : "no"}`;
      })
      .join("\n") +
    "\n",
);

if (process.argv.includes("--release") && releaseBlocked) process.exitCode = 1;
