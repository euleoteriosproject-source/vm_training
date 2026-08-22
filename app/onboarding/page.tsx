import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
export default async function OnboardingPage() {
  if (!hasSupabaseEnv()) redirect("/setup");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,birth_date,height_cm,onboarding_completed")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile?.onboarding_completed) redirect("/today");
  return <OnboardingFlow profile={profile} />;
}
