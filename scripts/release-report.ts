import { calculatePlanCoverage } from "../lib/media/operations.ts";
import { getAdminClient } from "./media/shared.ts";

const modeIndex = process.argv.indexOf("--mode");
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : "local";
if (!(["local", "production"] as const).includes(mode as "local" | "production"))
  throw new Error("Use --mode local ou --mode production");

const client = getAdminClient()!;
const [{ data: profiles, error: profileError }, { data: plans, error: planError }, { data: exercises, error: exerciseError }, { data: allowlist, error: allowlistError }, bucket] =
  await Promise.all([
    client.from("profiles").select("user_id,email,display_name,onboarding_completed"),
    client.from("workout_plans").select("id,user_id,name,status,workout_days(workout_day_exercises(exercise_id))"),
    client.from("exercises").select("id,exercise_media(status,media_role,execution_quality,is_primary)"),
    client.from("allowed_signup_emails").select("email,active").eq("active", true),
    client.storage.getBucket("exercise-media"),
  ]);
for (const error of [profileError, planError, exerciseError, allowlistError])
  if (error) throw error;

const primaryIds = new Set(
  (exercises ?? [])
    .filter((exercise) =>
      exercise.exercise_media?.some(
        (media) =>
          media.status === "approved" &&
          media.media_role === "PRIMARY_DEMO" &&
          media.execution_quality === "approved" &&
          media.is_primary,
      ),
    )
    .map((exercise) => exercise.id),
);
const media = (exercises ?? []).flatMap((exercise) => exercise.exercise_media ?? []);
const authorized = [
  "vinicius.euleoterio@hotmail.com",
  "lisepaiva@hotmail.com",
];
const activeAllowlist = (allowlist ?? []).map((entry) => entry.email.toLowerCase()).sort();
const productionAllowlistOk =
  activeAllowlist.length === authorized.length &&
  authorized.every((email) => activeAllowlist.includes(email));
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const hosted = (() => {
  try {
    return new URL(supabaseUrl).hostname.endsWith(".supabase.co");
  } catch {
    return false;
  }
})();

function userReport(email: string) {
  const profile = profiles?.find((item) => item.email.toLowerCase() === email);
  const userPlans = profile
    ? (plans ?? []).filter((plan) => plan.user_id === profile.user_id)
    : [];
  const plan =
    userPlans.find((item) => item.status === "active") ??
    userPlans.find((item) => item.status === "draft") ??
    null;
  const ids = (plan?.workout_days ?? []).flatMap((day) =>
    (day.workout_day_exercises ?? []).map((item) => item.exercise_id),
  );
  const calculated = calculatePlanCoverage(ids, primaryIds);
  return {
    profile,
    plan,
    coverage:
      plan && ids.length
        ? calculated
        : { ...calculated, percentage: 0 },
  };
}

const vinicius = userReport(authorized[0]);
const marlise = userReport(authorized[1]);
const pending = media.filter((item) =>
  ["pending", "reviewing", "processing", "processed", "failed"].includes(item.status),
).length;
const educational = media.filter(
  (item) => item.status === "approved" && item.media_role === "EDUCATIONAL",
).length;
const variations = media.filter(
  (item) => item.status === "approved" && item.media_role === "ALTERNATIVE_VARIATION",
).length;
const coverage = exercises?.length
  ? Number(((primaryIds.size / exercises.length) * 100).toFixed(1))
  : 0;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "NOT CONFIGURED";
const hookVerified = process.env.SUPABASE_AUTH_HOOK_VERIFIED === "true";

function describeUser(label: string, report: ReturnType<typeof userReport>) {
  return `${label}:
Account: ${report.profile ? "CREATED" : "MISSING"}
Onboarding: ${report.profile?.onboarding_completed ? "COMPLETE" : "PENDING"}
Profile: ${report.profile?.display_name ?? "MISSING"}`;
}
function describePlan(label: string, report: ReturnType<typeof userReport>) {
  return `${label}:
Plan: ${report.plan?.name ?? "MISSING"}
Exercises: ${report.coverage.exercises}
Primary Media: ${report.coverage.primaryApproved}
Plan Coverage: ${report.coverage.percentage.toFixed(1)}%
Status: ${report.plan?.status ?? "MISSING"}`;
}

const productionReady =
  hosted &&
  !bucket.error &&
  hookVerified &&
  productionAllowlistOk &&
  vinicius.profile?.onboarding_completed === true &&
  marlise.profile?.onboarding_completed === true &&
  vinicius.plan?.status === "active" &&
  marlise.plan?.status === "active" &&
  vinicius.coverage.percentage === 100 &&
  marlise.coverage.percentage === 100 &&
  appUrl.startsWith("https://");
const releaseStatus = productionReady ? "READY FOR PRODUCTION" : "NOT READY";

process.stdout.write(`VM Training v1.4 — Production Readiness Report

Infrastructure

Supabase Production: ${hosted ? "CONNECTED" : "NOT CONNECTED"}
Storage: ${bucket.error ? "FAIL" : "PASS"}
Migrations: CHECKED BY release:check / Supabase CLI
Auth Hook: ${hookVerified ? "VERIFIED" : "NOT VERIFIED"}
RLS: CHECKED BY pgTAP
Vercel: ${appUrl}

Users

${describeUser("Vinicius", vinicius)}

${describeUser("Marlise", marlise)}

Media

Candidates: ${media.length}
Primary Approved: ${primaryIds.size}
Educational: ${educational}
Variations: ${variations}
Pending: ${pending}
Missing: ${(exercises?.length ?? 0) - primaryIds.size}
Catalog Primary Coverage: ${coverage.toFixed(1)}%

Plans

${describePlan("Vinicius", vinicius)}

${describePlan("Marlise", marlise)}

Quality

Lint: release:check
Typecheck: release:check
Unit: release:check
pgTAP: release:check
Playwright: release:check
Media E2E: ${process.env.E2E_MEDIA_TEST === "true" ? "ENABLED" : "NOT ENABLED"}
Offline E2E: release:check
Build: release:check

Production

URL: ${appUrl}
Health: smoke:production
Public without Vercel Auth: smoke:production
Supabase Auth: ${hosted ? "CONFIGURED" : "LOCAL ONLY"}
Production Smoke: smoke:production

Allowlist: ${productionAllowlistOk ? "PASS" : "FAIL"}
Release Status: ${releaseStatus}
`);

if (mode === "production" && !productionReady) process.exitCode = 1;
