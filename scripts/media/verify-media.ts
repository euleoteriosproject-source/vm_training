import { calculateCoverage } from "../../lib/media/coverage.ts";
import { getAdminClient, log } from "./shared.ts";
const production =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";
const client = getAdminClient(false);
if (!client) {
  const message =
    "Supabase não configurado; cobertura de mídia não pôde ser validada.";
  if (production) throw new Error(message);
  log("REPORT", `WARNING: ${message}`);
} else {
  const { data, error } = await client
    .from("exercises")
    .select(
      "id,name_pt,active,exercise_media(status,media_role,execution_quality,is_primary)",
    )
    .eq("active", true);
  if (error) {
    if (production) throw error;
    log("REPORT", `WARNING: ${error.message}`);
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
    if (result.activeMissing.length) {
      const message = `Exercícios ativos sem mídia aprovada: ${result.activeMissing.map((item) => item.name).join(", ")}`;
      if (production) throw new Error(message);
      log("REPORT", `WARNING: ${message}`);
    } else
      log(
        "REPORT",
        `Validação concluída: ${result.approved}/${result.total} exercícios ativos cobertos.`,
      );
  }
}
