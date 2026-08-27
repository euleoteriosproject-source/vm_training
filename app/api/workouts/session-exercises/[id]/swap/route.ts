import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  sessionSwapReasonSchema,
  sessionSwapRequestSchema,
  type SessionReplacementCandidate,
} from "@/lib/workout/session-swap";

type CandidateRow = {
  exercise_id: string;
  exercise_name: string;
  movement_pattern: string;
  training_role: string;
  category: string;
  difficulty: string;
  primary_muscles: string[];
  equipment_names: string[];
  media_storage_path: string;
  media_poster_path: string | null;
  media_type: string;
  replacement_type: "DIRECT_EQUIVALENT" | "GOAL_ALIGNED_ALTERNATIVE";
  reason: string;
  goal_alignment_reason: string;
  total_count: number;
};

async function authenticatedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user } = await authenticatedClient();
  if (!user)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const url = new URL(request.url);
  const parsedReason = sessionSwapReasonSchema.safeParse(
    url.searchParams.get("reason") || "user_choice",
  );
  if (!parsedReason.success)
    return NextResponse.json({ error: "Motivo inválido." }, { status: 400 });
  const equipmentId = url.searchParams.get("equipmentId") || null;
  const query = url.searchParams.get("q")?.trim() || null;
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit")) || 12, 1),
    30,
  );
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
  const { data, error } = await supabase.rpc(
    "get_workout_replacement_candidates_v214",
    {
      p_session_exercise_id: id,
      p_reason_code: parsedReason.data,
      p_equipment_id: equipmentId,
      p_query: query,
      p_limit: limit,
      p_offset: offset,
    },
  );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 422 });

  const candidates = await Promise.all(
    ((data ?? []) as CandidateRow[]).map(async (row) => {
      const [{ data: media }, { data: poster }] = await Promise.all([
        supabase.storage
          .from("exercise-media")
          .createSignedUrl(row.media_storage_path, 3600),
        row.media_poster_path
          ? supabase.storage
              .from("exercise-media")
              .createSignedUrl(row.media_poster_path, 3600)
          : Promise.resolve({ data: null }),
      ]);
      return {
        exerciseId: row.exercise_id,
        exerciseName: row.exercise_name,
        movementPattern: row.movement_pattern,
        trainingRole: row.training_role,
        category: row.category,
        difficulty: row.difficulty,
        primaryMuscles: row.primary_muscles,
        equipmentNames: row.equipment_names,
        mediaUrl: media?.signedUrl ?? null,
        posterUrl: poster?.signedUrl ?? null,
        mediaType: row.media_type === "gif" ? "gif" : "video",
        replacementType: row.replacement_type,
        reason: row.reason,
        goalAlignmentReason: row.goal_alignment_reason,
        totalCount: Number(row.total_count),
      } satisfies SessionReplacementCandidate;
    }),
  );
  return NextResponse.json({ candidates });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user } = await authenticatedClient();
  if (!user)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const parsed = sessionSwapRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Solicitação inválida." },
      { status: 400 },
    );
  const operation =
    parsed.data.action === "undo"
      ? supabase.rpc("undo_workout_substitution_v214", {
          p_event_id: parsed.data.eventId,
        })
      : supabase.rpc("substitute_workout_exercise_v214", {
          p_session_exercise_id: id,
          p_replacement_exercise_id: parsed.data.replacementExerciseId,
          p_replacement_type: parsed.data.replacementType,
          p_reason_code: parsed.data.reasonCode,
          p_equipment_id: parsed.data.equipmentId,
          p_persist_change: parsed.data.persistChange,
        });
  const { data, error } = await operation;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json(data);
}
