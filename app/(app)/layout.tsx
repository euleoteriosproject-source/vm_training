import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabaseEnv()) redirect("/setup");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed,role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.onboarding_completed) redirect("/onboarding");
  return (
    <>
      <AppNav
        admin={profile.role === "admin"}
        adminMaintenance={Boolean(process.env.SUPABASE_SECRET_KEY)}
      />
      <main className="mx-auto min-h-dvh max-w-7xl px-4 pb-28 pt-7 md:pl-[calc(16rem+2rem)] md:pr-8 md:pb-10">
        {children}
      </main>
    </>
  );
}
