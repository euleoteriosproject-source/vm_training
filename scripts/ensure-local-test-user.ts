import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient, isLocalSupabaseUrl } from "./media/shared.ts";

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
      `E2E_SIGNUP_EMAIL_MOBILE=${signupEmails.mobile}`,
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

const { data: approved, error: mediaError } = await userClient
  .from("exercise_media")
  .select("exercise_id")
  .eq("status", "approved")
  .eq("media_role", "PRIMARY_DEMO")
  .eq("is_primary", true)
  .limit(3);
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
