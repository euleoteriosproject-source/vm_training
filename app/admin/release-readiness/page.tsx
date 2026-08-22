import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { calculatePlanCoverage } from "@/lib/media/operations";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ReleaseReadinessPage() {
  const sessionClient = await createClient();
  const { data: auth } = await sessionClient.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: currentProfile } = await sessionClient
    .from("profiles")
    .select("role")
    .eq("user_id", auth.user.id)
    .single();
  if (currentProfile?.role !== "admin") redirect("/today");

  const admin = createAdminClient();
  const [{ data: profiles }, { data: plans }, { data: exercises }, bucket] =
    await Promise.all([
      admin
        .from("profiles")
        .select("user_id,email,display_name,onboarding_completed"),
      admin
        .from("workout_plans")
        .select(
          "id,user_id,name,status,workout_days(workout_day_exercises(exercise_id))",
        ),
      admin
        .from("exercises")
        .select(
          "id,exercise_media(status,media_role,execution_quality,is_primary)",
        ),
      admin.storage.getBucket("exercise-media"),
    ]);
  const approved = new Set(
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
  const people = [
    ["Vinicius", "vinicius.euleoterio@hotmail.com"],
    ["Marlise", "lisepaiva@hotmail.com"],
  ].map(([label, email]) => {
    const profile = profiles?.find(
      (item) => item.email.toLowerCase() === email,
    );
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
    return {
      label,
      profile,
      plan,
      coverage: calculatePlanCoverage(ids, approved),
    };
  });
  const blockers = people.reduce(
    (total, person) => total + person.coverage.missing.length,
    0,
  );
  const hosted = (() => {
    try {
      return new URL(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      ).hostname.endsWith(".supabase.co");
    } catch {
      return false;
    }
  })();
  const ready =
    hosted &&
    !bucket.error &&
    people.every(
      (person) =>
        person.profile?.onboarding_completed &&
        person.plan?.status === "active" &&
        person.coverage.percentage === 100,
    );

  return (
    <div>
      <p className="text-sm text-accent">Administração</p>
      <h1 className="mt-1 text-3xl font-semibold">Release Readiness</h1>
      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">Infraestrutura</h2>
          <Status label="Supabase Hosted" ok={hosted} />
          <Status label="Storage" ok={!bucket.error} />
          <Status
            label="Auth Hook verificado"
            ok={process.env.SUPABASE_AUTH_HOOK_VERIFIED === "true"}
          />
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">Planos reais</h2>
          {people.map((person) => (
            <div
              key={person.label}
              className="mt-4 border-t pt-4 first:border-0 first:pt-0"
            >
              <div className="flex items-center justify-between gap-3">
                <span>{person.label}</span>
                <span className="font-semibold">
                  {person.coverage.percentage.toFixed(1)}%
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                Conta {person.profile ? "criada" : "ausente"} · Onboarding{" "}
                {person.profile?.onboarding_completed ? "completo" : "pendente"}{" "}
                · Plano {person.plan?.status ?? "ausente"}
              </p>
            </div>
          ))}
        </Card>
      </div>
      <Card className="mt-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        {ready ? (
          <CheckCircle2 className="text-success" size={28} />
        ) : (
          <AlertTriangle className="text-warning" size={28} />
        )}
        <div className="flex-1">
          <p className="font-semibold">
            {ready ? "READY FOR PRODUCTION" : "NOT READY"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {blockers} bloqueios de mídia nos planos atuais.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/media-review">Resolver blockers</Link>
        </Button>
      </Card>
    </div>
  );
}

function Status({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="mt-4 flex items-center justify-between border-t pt-4">
      <span className="text-sm">{label}</span>
      <span className={ok ? "text-success" : "text-warning"}>
        {ok ? "✓" : "Pendente"}
      </span>
    </div>
  );
}
