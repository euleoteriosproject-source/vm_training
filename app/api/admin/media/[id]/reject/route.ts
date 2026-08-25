import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminClient,
  isAdminMaintenanceConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
const schema = z.object({
  reason: z.enum([
    "wrong_exercise",
    "wrong_equipment",
    "poor_execution",
    "poor_visibility",
    "incomplete_movement",
    "license_issue",
    "low_quality",
    "duplicate",
    "other",
  ]),
  notes: z.string().max(1000).optional(),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Informe o motivo" }, { status: 400 });
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
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("exercise_media")
    .select("status")
    .eq("id", id)
    .single();
  if (!current)
    return NextResponse.json(
      { error: "Candidato não encontrado" },
      { status: 404 },
    );
  const now = new Date().toISOString();
  const { error } = await admin
    .from("exercise_media")
    .update({
      status: "rejected",
      review_state: "REJECTED",
      review_method: "human",
      review_agent: null,
      validation_version: null,
      validation_confidence: null,
      automated_validation: {},
      execution_quality: "rejected",
      review_notes: parsed.data.notes ?? null,
      rejection_reason: parsed.data.reason,
      is_primary: false,
      reviewed_at: now,
      reviewed_by: user.id,
      verified_at: now,
      verified_by: user.id,
      ready_for_processing: false,
    })
    .eq("id", id);
  if (!error)
    await admin.from("media_review_events").insert({
      media_id: id,
      admin_user_id: user.id,
      action: "rejected",
      from_status: current.status,
      to_status: "rejected",
      notes: parsed.data.notes ?? parsed.data.reason,
      metadata: { reason: parsed.data.reason, review_method: "human" },
    });
  return error
    ? NextResponse.json({ error: error.message }, { status: 422 })
    : NextResponse.json({ ok: true });
}
