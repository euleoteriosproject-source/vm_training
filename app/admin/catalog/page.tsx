import { CatalogAdmin } from "@/components/admin/catalog-admin";
import { createClient } from "@/lib/supabase/server";
export default async function CatalogPage() {
  const supabase = await createClient();
  const [{ data: equipment }, { data: emails }] = await Promise.all([
    supabase.from("equipment").select("id,slug,name,active").order("name"),
    supabase
      .from("allowed_signup_emails")
      .select("id,email,display_name,default_role,active")
      .order("email"),
  ]);
  return (
    <div>
      <p className="text-sm text-accent">Administração</p>
      <h1 className="mt-1 mb-7 text-3xl font-semibold">Catálogo global</h1>
      <CatalogAdmin equipment={equipment ?? []} emails={emails ?? []} />
    </div>
  );
}
