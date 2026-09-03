import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function isLocalUrl(value: string) {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(
      new URL(value).hostname,
    );
  } catch {
    return false;
  }
}

function loadLocalSupabaseEnvironment() {
  if (
    isLocalUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SECRET_KEY
  )
    return;
  const windowsCorepack = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "corepack",
    "dist",
    "corepack.js",
  );
  const result = spawnSync(
    process.platform === "win32" ? process.execPath : "corepack",
    process.platform === "win32"
      ? [windowsCorepack, "pnpm", "exec", "supabase", "status", "-o", "env"]
      : ["pnpm", "exec", "supabase", "status", "-o", "env"],
    { encoding: "utf8", windowsHide: true, shell: false },
  );
  if (result.status !== 0)
    throw new Error("Supabase local indisponível; execute supabase start");
  const output = result.stdout.trim();
  const values = output.startsWith("{")
    ? (JSON.parse(output) as Record<string, string>)
    : Object.fromEntries(
        output
          .split(/\r?\n/)
          .filter((line) => /^[A-Z_]+=/.test(line))
          .map((line) => {
            const separator = line.indexOf("=");
            return [
              line.slice(0, separator),
              line.slice(separator + 1).replace(/^"|"$/g, ""),
            ];
          }),
      );
  if (!isLocalUrl(values.API_URL ?? ""))
    throw new Error("Supabase local retornou configuração inválida");
  process.env.NEXT_PUBLIC_SUPABASE_URL = values.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
    values.PUBLISHABLE_KEY ?? values.ANON_KEY;
  process.env.SUPABASE_SECRET_KEY =
    values.SECRET_KEY ?? values.SERVICE_ROLE_KEY;
}

loadLocalSupabaseEnvironment();
const { getAdminClient, isLocalSupabaseUrl } = await import("./media/shared.ts");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!isLocalSupabaseUrl(url))
  throw new Error("Este comando só pode preparar usuário no Supabase local");
if (!publishableKey)
  throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ausente");

const adminClient = getAdminClient()!;
let { data: profile, error: profileError } = await adminClient
  .from("profiles")
  .select("user_id")
  .eq("role", "admin")
  .limit(1)
  .single();
if (profileError?.code === "PGRST116") {
  const { data: invitation, error: invitationError } = await adminClient
    .from("allowed_signup_emails")
    .select("email")
    .eq("default_role", "admin")
    .eq("active", true)
    .limit(1)
    .single();
  if (invitationError || !invitation)
    throw invitationError ?? new Error("Convite admin local ausente");
  const { data: created, error: createError } =
    await adminClient.auth.admin.createUser({
      email: invitation.email,
      password: randomBytes(24).toString("base64url"),
      email_confirm: true,
    });
  if (createError || !created.user)
    throw createError ?? new Error("Não foi possível criar o admin local");
  profile = { user_id: created.user.id };
  profileError = null;
}
if (profileError || !profile) throw profileError;
const { data: authUser, error: userError } =
  await adminClient.auth.admin.getUserById(profile.user_id);
if (userError || !authUser.user?.email)
  throw userError ?? new Error("Usuário admin local sem e-mail");
const authEmail = authUser.user.email;

const password = randomBytes(24).toString("base64url");
const signupPassword = `VmE2E${randomBytes(18).toString("base64url")}7`;
const signupEmails = {
  mobile: "v172-mobile@example.test",
  webkit: "v172-webkit@example.test",
  desktop: "v172-desktop@example.test",
};
async function writeE2EEnv(
  sessionId?: string,
  mediaEnabled = Boolean(sessionId),
) {
  await mkdir(".tmp", { recursive: true });
  await writeFile(
    ".tmp/e2e.local.env",
    [
      `E2E_TEST_EMAIL=${authEmail}`,
      `E2E_TEST_PASSWORD=${password}`,
      `NEXT_PUBLIC_SUPABASE_URL=${url}`,
      `SUPABASE_INTERNAL_URL=${url}`,
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
      `SUPABASE_SECRET_KEY=${process.env.SUPABASE_SECRET_KEY}`,
      `E2E_SIGNUP_EMAIL_MOBILE=${signupEmails.mobile}`,
      `E2E_SIGNUP_EMAIL_WEBKIT=${signupEmails.webkit}`,
      `E2E_SIGNUP_EMAIL_DESKTOP=${signupEmails.desktop}`,
      `E2E_SIGNUP_PASSWORD=${signupPassword}`,
      `E2E_MEDIA_TEST=${mediaEnabled ? "true" : "false"}`,
      ...(sessionId ? [`E2E_SESSION_ID=${sessionId}`] : []),
      "",
    ].join("\n"),
  );
}
const { data: users, error: listUsersError } =
  await adminClient.auth.admin.listUsers();
if (listUsersError) throw listUsersError;
for (const user of users.users) {
  if (user.email && Object.values(signupEmails).includes(user.email)) {
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(
      user.id,
    );
    if (deleteUserError) throw deleteUserError;
  }
}
const { error: passwordError } = await adminClient.auth.admin.updateUserById(
  profile.user_id,
  { password, email_confirm: true },
);
if (passwordError) throw passwordError;
const userClient = createClient(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error: signInError } = await userClient.auth.signInWithPassword({
  email: authEmail,
  password,
});
if (signInError) throw signInError;

const { error: signupAllowlistError } = await userClient
  .from("allowed_signup_emails")
  .upsert(
    Object.entries(signupEmails).map(([project, email]) => ({
      email,
      display_name: `VM Training E2E ${project}`,
      default_role: "member",
      active: true,
    })),
    { onConflict: "email" },
  );
if (signupAllowlistError) throw signupAllowlistError;

const { error: onboardingError } = await userClient.rpc("complete_onboarding", {
  payload: {
    displayName: "VM Training E2E",
    birthDate: "1990-01-01",
    heightCm: 175,
    weightKg: 75,
    goalCode: "general_health",
    sessionsPerWeek: 2,
    sessionMinutes: 45,
    experience: "returning",
    gymCategory: "academia_completa",
    movementAttention: [],
  },
});
if (onboardingError) throw onboardingError;

const fixtureGif = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAEALAAAAAABAAEAAAICRAEAIfkEAQAAAQAsAAAAAAEAAQAAAgJEADs=",
  "base64",
);
const fixtureHash = createHash("sha256").update(fixtureGif).digest("hex");
const fixtureStoragePath = "e2e/leg-press/primary.gif";
const fixturePosterPath = "e2e/leg-press/poster.gif";
for (const objectPath of [fixtureStoragePath, fixturePosterPath]) {
  const { error: uploadError } = await adminClient.storage
    .from("exercise-media")
    .upload(objectPath, fixtureGif, {
      contentType: "image/gif",
      upsert: true,
    });
  if (uploadError) throw uploadError;
}
const { data: fixtureExercise, error: fixtureExerciseError } = await adminClient
  .from("exercises")
  .select("id")
  .eq("slug", "leg-press")
  .single();
if (fixtureExerciseError || !fixtureExercise)
  throw fixtureExerciseError ?? new Error("Exercício E2E ausente");
const checklist = {
  correct_exercise: true,
  compatible_equipment: true,
  start_position_visible: true,
  main_range_visible: true,
  complete_repetition_visible: true,
  technically_acceptable: true,
  sufficient_clarity: true,
  useful_framing: true,
  no_blocking_elements: true,
  license_confirmed: true,
};
const automatedValidation = {
  exercise_match_exact: true,
  equipment_match: true,
  execution_quality_approved: true,
  visibility_sufficient: true,
  license_verified: true,
  download_permitted: true,
  transformation_permitted: true,
  rehost_permitted: true,
  source_provenance_verified: true,
  visual_inspection_passed: true,
  biomechanical_references_passed: true,
  final_gif_inspection_passed: true,
  storage_hash_verified: true,
};
const fixtureSourceUrl =
  "https://example.test/vm-training/local-e2e-leg-press";
const { data: existingFixture, error: existingFixtureError } = await adminClient
  .from("exercise_media")
  .select("id,status")
  .eq("exercise_id", fixtureExercise.id)
  .eq("source_url", fixtureSourceUrl)
  .maybeSingle();
if (existingFixtureError) throw existingFixtureError;
if (existingFixture?.status !== "approved") {
  await adminClient
    .from("exercise_media")
    .update({ status: "reviewing", is_primary: false })
    .eq("exercise_id", fixtureExercise.id)
    .eq("status", "approved")
    .neq("source_url", fixtureSourceUrl);
  const now = new Date().toISOString();
  const { data: fixtureMedia, error: fixtureMediaError } = await adminClient
    .from("exercise_media")
    .upsert(
      {
      exercise_id: fixtureExercise.id,
      media_type: "gif",
      storage_path: fixtureStoragePath,
      poster_path: fixturePosterPath,
      angle: "main",
      status: "processed",
      source_name: "VM Training local E2E fixture",
      source_type: "self_produced",
      source_url: fixtureSourceUrl,
      original_file_url:
        "https://example.test/vm-training/local-e2e-leg-press.gif",
      license_code: "CUSTOM",
      author: "VM Training E2E",
      attribution_text: "Disposable local E2E fixture",
      attribution_required: false,
      verified_at: now,
      downloaded_at: now,
      content_hash: fixtureHash,
      width: 1,
      height: 1,
      file_size_bytes: fixtureGif.byteLength,
      is_primary: false,
      quality_score: 100,
      execution_quality: "approved",
      media_role: "PRIMARY_DEMO",
      review_checklist: checklist,
      reviewed_at: now,
      reviewed_by: profile.user_id,
      processed_at: now,
      animation_verified: true,
      frame_count: 2,
      animation_loop: true,
      frames_per_second: 1,
      duration_seconds: 2,
      review_state: "MANUAL_REVIEW_REQUIRED",
      review_method: "human",
      automated_validation: automatedValidation,
      },
      { onConflict: "exercise_id,source_url" },
    )
    .select("id")
    .single();
  if (fixtureMediaError || !fixtureMedia)
    throw fixtureMediaError ?? new Error("Mídia E2E não criada");
  const { error: publishFixtureError } = await adminClient.rpc(
    "publish_exercise_media",
    { p_media_id: fixtureMedia.id, p_admin_id: profile.user_id },
  );
  if (publishFixtureError) throw publishFixtureError;
}
const { error: fixtureActivationError } = await adminClient
  .from("exercises")
  .update({ active: true })
  .eq("id", fixtureExercise.id);
if (fixtureActivationError) throw fixtureActivationError;

// The v2.1.5 preview exercises the real goal-driven gym-first generator. A disposable
// local catalog therefore needs enough media-ready movement patterns to meet
// the same diversity gate used in production.
const v211FixtureSlugs = [
  "bodyweight-half-squat",
  "goblet-squat",
  "hack-squat",
  "machine-row",
  "seated-row",
  "lying-leg-curl",
  "seated-leg-curl",
  "machine-glute",
  "hip-thrust",
  "machine-shoulder-press",
  "lateral-raise",
  "farmer-walk",
  "dead-bug",
  "pallof-press",
  "machine-chest-press",
  "incline-machine-press",
  "machine-fly",
  "lat-pulldown",
  "neutral-pulldown",
  "supinated-pulldown",
  "leg-extension",
  "wall-slide",
  "treadmill",
] as const;
const { data: v211Fixtures, error: v211FixturesError } = await adminClient
  .from("exercises")
  .select("id,slug")
  .in("slug", [...v211FixtureSlugs]);
if (v211FixturesError || v211Fixtures?.length !== v211FixtureSlugs.length)
  throw v211FixturesError ?? new Error("Catálogo E2E v2.1.1 incompleto");

for (const exercise of v211Fixtures) {
  const mediaBytes = Buffer.concat([fixtureGif, Buffer.from(exercise.slug)]);
  const mediaHash = createHash("sha256").update(mediaBytes).digest("hex");
  const storagePath = `e2e/v211/${exercise.slug}/primary.gif`;
  const posterPath = `e2e/v211/${exercise.slug}/poster.gif`;
  for (const objectPath of [storagePath, posterPath]) {
    const { error: uploadError } = await adminClient.storage
      .from("exercise-media")
      .upload(objectPath, mediaBytes, {
        contentType: "image/gif",
        upsert: true,
      });
    if (uploadError) throw uploadError;
  }

  const sourceUrl = `https://example.test/vm-training/local-e2e-v211/${exercise.slug}`;
  const { data: existingMedia, error: existingMediaError } = await adminClient
    .from("exercise_media")
    .select("id,status")
    .eq("exercise_id", exercise.id)
    .eq("source_url", sourceUrl)
    .maybeSingle();
  if (existingMediaError) throw existingMediaError;
  if (existingMedia?.status !== "approved") {
    await adminClient
      .from("exercise_media")
      .update({ status: "reviewing", is_primary: false })
      .eq("exercise_id", exercise.id)
      .eq("status", "approved")
      .neq("source_url", sourceUrl);
    const now = new Date().toISOString();
    const { data: media, error: mediaError } = await adminClient
      .from("exercise_media")
      .upsert(
        {
          exercise_id: exercise.id,
          media_type: "gif",
          storage_path: storagePath,
          poster_path: posterPath,
          angle: "main",
          status: "processed",
          source_name: "VM Training local E2E fixture v2.1.1",
          source_type: "self_produced",
          source_url: sourceUrl,
          original_file_url: `${sourceUrl}.gif`,
          license_code: "CUSTOM",
          author: "VM Training E2E",
          attribution_text: "Disposable local E2E fixture",
          attribution_required: false,
          verified_at: now,
          downloaded_at: now,
          content_hash: mediaHash,
          width: 1,
          height: 1,
          file_size_bytes: mediaBytes.byteLength,
          is_primary: false,
          quality_score: 100,
          execution_quality: "approved",
          media_role: "PRIMARY_DEMO",
          review_checklist: checklist,
          reviewed_at: now,
          reviewed_by: profile.user_id,
          processed_at: now,
          animation_verified: true,
          frame_count: 2,
          animation_loop: true,
          frames_per_second: 1,
          duration_seconds: 2,
          review_state: "MANUAL_REVIEW_REQUIRED",
          review_method: "human",
          automated_validation: automatedValidation,
        },
        { onConflict: "exercise_id,source_url" },
      )
      .select("id")
      .single();
    if (mediaError || !media)
      throw mediaError ?? new Error("Mídia E2E v2.1.1 não criada");
    const { error: publishError } = await adminClient.rpc(
      "publish_exercise_media",
      { p_media_id: media.id, p_admin_id: profile.user_id },
    );
    if (publishError) throw publishError;
  }
}
const { error: v211ActivationError } = await adminClient
  .from("exercises")
  .update({ active: true })
  .in("slug", [...v211FixtureSlugs]);
if (v211ActivationError) throw v211ActivationError;

// Keep the local fixture independent from preset changes while still exercising
// the same per-user equipment gate used in production.
const { data: requiredEquipment, error: requiredEquipmentError } =
  await adminClient
    .from("exercise_equipment")
    .select("equipment_id")
    .eq("exercise_id", fixtureExercise.id)
    .eq("required", true);
if (requiredEquipmentError) throw requiredEquipmentError;
if (requiredEquipment?.length) {
  const { error: fixtureEquipmentError } = await userClient
    .from("user_equipment")
    .upsert(
      requiredEquipment.map(({ equipment_id }) => ({
        user_id: profile.user_id,
        equipment_id,
        available: true,
        temporary_unavailable_until: null,
        source: "user_override",
      })),
      { onConflict: "user_id,equipment_id" },
    );
  if (fixtureEquipmentError) throw fixtureEquipmentError;
}

const { data: autoPlanCatalog, error: autoPlanCatalogError } =
  await userClient.rpc("get_auto_plan_catalog");
if (autoPlanCatalogError) throw autoPlanCatalogError;
const typedAutoPlanCatalog = autoPlanCatalog as
  | Array<{
      id: string;
      auto_plan_eligible: boolean;
      eligibility_reasons: string[];
    }>
  | null;
const fixtureEligibility = typedAutoPlanCatalog?.find(
  (exercise) => exercise.id === fixtureExercise.id,
);
if (!fixtureEligibility?.auto_plan_eligible) {
  const reasons = fixtureEligibility?.eligibility_reasons?.length
    ? fixtureEligibility.eligibility_reasons.join(", ")
    : "fixture_not_returned";
  throw new Error(`Fixture E2E inelegível: ${reasons}`);
}

const { data: approved, error: mediaError } = await userClient
  .from("exercise_media")
  .select("exercise_id")
  .eq("status", "approved")
  .eq("media_role", "PRIMARY_DEMO")
  .eq("is_primary", true)
  .eq("exercise_id", fixtureExercise.id)
  .limit(1);
if (mediaError) throw mediaError;
let exerciseIds = [
  ...new Set((approved ?? []).map((item) => item.exercise_id)),
];
const hasApprovedMedia = exerciseIds.length > 0;
if (!exerciseIds.length) {
  const { data: fallbackExercises, error: fallbackError } = await adminClient
    .from("exercises")
    .select("id")
    .limit(3);
  if (fallbackError || !fallbackExercises?.length)
    throw fallbackError ?? new Error("Catálogo local sem exercícios E2E");
  exerciseIds = fallbackExercises.map((exercise) => exercise.id);
  const { error: activationError } = await adminClient
    .from("exercises")
    .update({ active: true })
    .in("id", exerciseIds);
  if (activationError) throw activationError;
}

await userClient
  .from("workout_plans")
  .update({ status: "archived", archived_at: new Date().toISOString() })
  .in("status", ["active", "draft"]);
const { data: plan, error: planError } = await userClient
  .from("workout_plans")
  .insert({
    user_id: profile.user_id,
    name: "Plano E2E GIF-first",
    status: "draft",
    source: "custom",
    sessions_per_week: 2,
    target_session_minutes: 45,
  })
  .select("id")
  .single();
if (planError) throw planError;
const { data: day, error: dayError } = await userClient
  .from("workout_days")
  .insert({
    workout_plan_id: plan.id,
    name: "Treino GIF-first",
    position: 1,
    estimated_minutes: 30,
  })
  .select("id")
  .single();
if (dayError) throw dayError;
const { error: exerciseError } = await userClient
  .from("workout_day_exercises")
  .insert(
    exerciseIds.map((exerciseId, index) => ({
      workout_day_id: day.id,
      exercise_id: exerciseId,
      position: index + 1,
      target_sets: 2,
      rep_min: 8,
      rep_max: 12,
      rest_seconds: 60,
    })),
  );
if (exerciseError) throw exerciseError;
const { error: activationError } = await userClient.rpc("activate_plan", {
  p_plan_id: plan.id,
});
if (activationError) throw activationError;
const { data: sessionId, error: sessionError } = await userClient.rpc(
  "start_workout",
  { p_workout_day_id: day.id },
);
if (sessionError) throw sessionError;

await writeE2EEnv(sessionId, hasApprovedMedia);
process.stdout.write(
  `Usuário, onboarding e plano E2E locais confirmados${hasApprovedMedia ? " com mídia" : " com fallback sem mídia"}.\n`,
);
