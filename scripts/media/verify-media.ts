import { calculateCoverage } from "../../lib/media/coverage.ts";
import { getAdminClient, log } from "./shared.ts";
const required = process.env.MEDIA_VALIDATION_REQUIRED === "true";
const client = getAdminClient(false);
if (!client) {
  const message =
    "Supabase não configurado; cobertura de mídia não pôde ser validada.";
  if (required) throw new Error(message);
  log("REPORT", `WARNING: ${message}`);
} else {
  const [{ data, error }, { data: activePlans, error: plansError }] =
    await Promise.all([
      client
        .from("exercises")
        .select(
          "id,name_pt,active,exercise_media(status,media_role,execution_quality,is_primary)",
        )
        .eq("active", true),
      client
        .from("workout_plans")
        .select("workout_days(workout_day_exercises(exercise_id))")
        .eq("status", "active"),
    ]);
  if (error || plansError) {
    const queryError = error ?? plansError!;
    if (required) throw queryError;
    log("REPORT", `WARNING: ${queryError.message}`);
  } else {
    const rows = (data ?? []).map((item) => ({
      exerciseId: item.id,
      name: item.name_pt,
      active: item.active,
      mediaStatuses: (item.exercise_media ?? [])
        .filter(
          (media: {
            status: string;
            media_role: string | null;
            execution_quality: string;
            is_primary: boolean;
          }) =>
            media.status === "approved" &&
            media.media_role === "PRIMARY_DEMO" &&
            media.execution_quality === "approved" &&
            media.is_primary,
        )
        .map(() => "approved"),
    }));
    const result = calculateCoverage(rows);
    const plannedIds = new Set(
      (activePlans ?? []).flatMap((plan) =>
        (plan.workout_days ?? []).flatMap((day) =>
          (day.workout_day_exercises ?? []).map((item) => item.exercise_id),
        ),
      ),
    );
    const mediaReadyIds = new Set(
      rows
        .filter((row) => row.mediaStatuses.includes("approved"))
        .map((row) => row.exerciseId),
    );
    const plannedMissing = [...plannedIds].filter(
      (id) => !mediaReadyIds.has(id),
    );
    if (plannedMissing.length)
      throw new Error(
        `Planos ativos sem PRIMARY_DEMO aprovada: ${plannedMissing.length}`,
      );
    if (result.activeMissing.length)
      log(
        "REPORT",
        `Catálogo fora do pool media-ready: ${result.activeMissing.length}; planos ativos: ${plannedIds.size}/${plannedIds.size}.`,
      );
    else
      log(
        "REPORT",
        `Validação concluída: catálogo ${result.approved}/${result.total}; planos ativos ${plannedIds.size}/${plannedIds.size}.`,
      );
  }
}
