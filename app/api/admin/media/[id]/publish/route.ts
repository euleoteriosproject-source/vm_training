import { NextResponse } from "next/server";
import {
  createAdminClient,
  isAdminMaintenanceConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  if (!isAdminMaintenanceConfigured())
    return NextResponse.json(
      { error: "Fluxo operacional indisponível neste deployment" },
      { status: 503 },
    );
  const { id } = await params;
  const { data, error } = await createAdminClient().rpc(
    "publish_exercise_media",
    { p_media_id: id, p_admin_id: user.id },
  );
  return error
    ? NextResponse.json({ error: error.message }, { status: 422 })
    : NextResponse.json({ ok: true, readiness: data });
}
