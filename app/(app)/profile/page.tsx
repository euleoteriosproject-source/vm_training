import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/profile/profile-form";
import { createClient } from "@/lib/supabase/server";
export default async function ProfilePage() {
  const supabase = await createClient();
  const [{ data: profile }, { data: goals }, { data: preferences }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("user_id,email,display_name,birth_date,height_cm")
        .single(),
      supabase
        .from("user_goals")
        .select("goal_code,priority")
        .eq("active", true)
        .order("priority"),
      supabase
        .from("training_preferences")
        .select(
          "sessions_per_week,session_minutes,cardio_preference,experience",
        )
        .single(),
    ]);
  if (!profile) return null;
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-accent">Sua conta</p>
      <h1 className="mt-1 text-3xl font-semibold">Perfil</h1>
      <Card className="mt-7 p-5 md:p-7">
        <ProfileForm profile={profile} />
      </Card>
      <Card id="preferences" className="mt-5 p-5 md:p-7">
        <h2 className="text-lg font-semibold">Treino e objetivos</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {(goals ?? []).map((goal) => (
            <span
              key={goal.goal_code}
              className="rounded-full bg-surface-alt px-3 py-2 text-sm"
            >
              {goal.goal_code.replaceAll("_", " ")}
            </span>
          ))}
        </div>
        <p className="mt-5 text-sm text-muted">
          {preferences?.sessions_per_week}x por semana ·{" "}
          {preferences?.session_minutes} min · cardio{" "}
          {preferences?.cardio_preference}/5
        </p>
        <Button variant="secondary" className="mt-5" asChild>
          <Link href="/settings/preferences">Alterar preferências</Link>
        </Button>
      </Card>
      <Button variant="ghost" className="mt-5" asChild>
        <Link href="/settings">Segurança e configurações</Link>
      </Button>
    </div>
  );
}
