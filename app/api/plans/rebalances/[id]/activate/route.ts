import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { planSwapErrorMessage } from "@/lib/workout/plan-swap";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { data, error } = await supabase.rpc("activate_plan_rebalance_v215", {
    p_plan_id: id,
  });
  if (error)
    return NextResponse.json(
      { error: planSwapErrorMessage(error.message) },
      { status: 422 },
    );
  return NextResponse.json(data);
}
