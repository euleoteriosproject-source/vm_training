import { NextResponse } from "next/server";
import { prepareExternalCandidate } from "@/lib/media/prepare";
import {
  createAdminClient,
  isAdminMaintenanceConfigured,
} from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

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
  const admin = createAdminClient();
  const { data: candidate, error } = await admin
    .from("exercise_media")
    .select(
      "id,status,original_file_url,trim_start,trim_end,media_role,poster_timestamp,ready_for_processing,exercise:exercises(slug)",
    )
    .eq("id", id)
    .single();
  if (error || !candidate)
    return NextResponse.json(
      { error: "Candidato não encontrado" },
      { status: 404 },
    );
  if (
    !["reviewing", "failed"].includes(candidate.status) ||
    !candidate.ready_for_processing
  )
    return NextResponse.json(
      { error: "A mídia precisa ser revisada antes do processamento" },
      { status: 409 },
    );
  const startedAt = new Date().toISOString();
  const start = await admin
    .from("exercise_media")
    .update({
      status: "processing",
      processing_started_at: startedAt,
      processing_error: null,
      processing_log: [{ at: startedAt, event: "processing_started" }],
    })
    .eq("id", id);
  if (start.error)
    return NextResponse.json({ error: start.error.message }, { status: 422 });
  await admin.from("media_review_events").insert({
    media_id: id,
    admin_user_id: user.id,
    action: "processing_started",
    from_status: candidate.status,
    to_status: "processing",
  });
  try {
    const prepared = await prepareExternalCandidate(admin, candidate as never);
    const update = await admin
      .from("exercise_media")
      .update(prepared)
      .eq("id", id);
    if (update.error) throw update.error;
    await admin.from("media_review_events").insert({
      media_id: id,
      admin_user_id: user.id,
      action: "processed",
      from_status: "processing",
      to_status: "processed",
    });
    return NextResponse.json({ ok: true, status: "processed" });
  } catch (processingError) {
    const message =
      processingError instanceof Error
        ? processingError.message.slice(0, 2000)
        : String(processingError).slice(0, 2000);
    await admin
      .from("exercise_media")
      .update({ status: "failed", processing_error: message })
      .eq("id", id);
    await admin.from("media_review_events").insert({
      media_id: id,
      admin_user_id: user.id,
      action: "processing_failed",
      from_status: "processing",
      to_status: "failed",
      notes: message,
    });
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
