import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: plan } = await supabase
    .from("workout_plans")
    .select("generator_version")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "draft")
    .maybeSingle();
  const rpc =
    plan?.generator_version === "v2.1.5"
      ? "activate_plan_v215"
      : "activate_plan_v211";
  const { data, error } = await supabase.rpc(rpc, {
    p_plan_id: id,
  });
  if (error)
    return NextResponse.json(
      { error: "Não foi possível ativar o novo treino." },
      { status: 422 },
    );
  return NextResponse.json(data);
}
