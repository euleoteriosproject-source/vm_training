import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { createClient } from "@/lib/supabase/server";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/today");
  return (
    <>
      <AppNav admin />
      <main className="mx-auto min-h-dvh max-w-7xl px-4 pb-28 pt-7 md:pl-[calc(16rem+2rem)] md:pr-8 md:pb-10">
        {children}
      </main>
    </>
  );
}
