import { NextResponse } from "next/server";
import { z } from "zod";
import {
  primaryChecklistKeys,
  validateMediaClassification,
} from "@/lib/media/operations";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const checklistShape = Object.fromEntries(
  primaryChecklistKeys.map((key) => [key, z.boolean()]),
) as Record<(typeof primaryChecklistKeys)[number], z.ZodBoolean>;

const schema = z
  .object({
    mediaRole: z.enum(["PRIMARY_DEMO", "EDUCATIONAL", "ALTERNATIVE_VARIATION"]),
    executionQuality: z.enum(["approved", "acceptable"]),
    checklist: z.object(checklistShape).partial().default({}),
    reviewNotes: z.string().max(1000).optional(),
    trimStart: z.number().min(0).default(0),
    trimEnd: z.number().positive().optional(),
    posterTimestamp: z.number().min(0).optional(),
  })
  .refine(
    (value) => value.trimEnd === undefined || value.trimEnd > value.trimStart,
    { message: "O fim do corte deve ser posterior ao início" },
  );

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  const user = await requireAdmin();
  if (!user)
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const classification = validateMediaClassification({
    role: parsed.data.mediaRole,
    executionQuality: parsed.data.executionQuality,
    checklist: parsed.data.checklist,
  });
  if (!classification.valid)
    return NextResponse.json(
      { error: `Revisão incompleta: ${classification.errors.join(", ")}` },
      { status: 422 },
    );
  const { id } = await params;
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("exercise_media")
    .select("status,storage_path")
    .eq("id", id)
    .single();
  if (currentError || !current)
    return NextResponse.json(
      { error: "Candidato não encontrado" },
      { status: 404 },
    );
  if (!["pending", "reviewing", "processed"].includes(current.status))
    return NextResponse.json(
      { error: `Estado ${current.status} não pode ser classificado` },
      { status: 409 },
    );
  const now = new Date().toISOString();
  const nextStatus = current.storage_path ? "processed" : "reviewing";
  const { error } = await admin
    .from("exercise_media")
    .update({
      status: nextStatus,
      media_role: parsed.data.mediaRole,
      execution_quality: parsed.data.executionQuality,
      review_checklist: parsed.data.checklist,
      review_notes: parsed.data.reviewNotes ?? null,
      trim_start: parsed.data.trimStart,
      trim_end: parsed.data.trimEnd ?? null,
      poster_timestamp: parsed.data.posterTimestamp ?? null,
      reviewed_by: user.id,
      reviewed_at: now,
      verified_by: user.id,
      verified_at: now,
      ready_for_processing: !current.storage_path,
      rejection_reason: null,
    })
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 422 });
  const action =
    parsed.data.mediaRole === "PRIMARY_DEMO"
      ? "classified_primary"
      : parsed.data.mediaRole === "EDUCATIONAL"
        ? "classified_educational"
        : "classified_variation";
  await admin.from("media_review_events").insert({
    media_id: id,
    admin_user_id: user.id,
    action,
    from_status: current.status,
    to_status: nextStatus,
    notes: parsed.data.reviewNotes ?? null,
  });
  return NextResponse.json({ ok: true, status: nextStatus });
}
