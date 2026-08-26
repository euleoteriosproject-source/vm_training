import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { createClient } from "@/lib/supabase/server";
import type { GoalCode } from "@/lib/workouts/types";
export default async function PreferencesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: preferences }, { data: goals }] =
    await Promise.all([
      supabase
        .from("training_preferences")
        .select("sessions_per_week,session_minutes,cardio_preference,gym_profile")
        .single(),
      supabase
        .from("user_goals")
        .select("goal_code,priority")
        .eq("user_id", user.id)
        .eq("active", true)
        .order("priority")
        .limit(1),
    ]);
  if (!preferences) return null;
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm text-accent">Personalização</p>
      <h1 className="mt-1 text-3xl font-semibold">Preferências de treino</h1>
      <p className="mt-3 text-muted">
        Mudanças não alteram silenciosamente seu plano atual.
      </p>
      <Card className="mt-7 p-5 md:p-7">
        <PreferencesForm
          preferences={preferences}
          goal={(goals?.[0]?.goal_code ?? "general_health") as GoalCode}
        />
      </Card>
    </div>
  );
}
