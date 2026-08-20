import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { createClient } from "@/lib/supabase/server";
export default async function PreferencesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: preferences }, { data: equipment }, { data: selected }] =
    await Promise.all([
      supabase
        .from("training_preferences")
        .select("sessions_per_week,session_minutes,cardio_preference")
        .single(),
      supabase
        .from("equipment")
        .select("id,name")
        .eq("active", true)
        .order("name"),
      supabase
        .from("user_equipment")
        .select("equipment_id")
        .eq("user_id", user.id),
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
          userId={user.id}
          preferences={preferences}
          equipment={equipment ?? []}
          selected={(selected ?? []).map((row) => row.equipment_id)}
        />
      </Card>
    </div>
  );
}
