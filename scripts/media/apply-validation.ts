import { readFile } from "node:fs/promises";
import { getAdminClient, parseArgs } from "./shared.ts";

type ValidationCandidate = {
  candidateId: string;
  exerciseSlug: string;
  sourceUrl: string;
  decision: "APPROVE" | "REJECT" | "KEEP_PENDING";
  recommendedRole: "PRIMARY_DEMO" | "EDUCATIONAL" | "ALTERNATIVE_VARIATION" | null;
  executionQuality: "approved" | "acceptable" | "rejected";
  trimStart: number | null;
  trimEnd: number | null;
  validationScore: number;
  exerciseMatch: string;
  reasoningSummary: string;
  reviewChecklist: {
    exerciseIdentity: boolean;
    correctVariation: boolean;
    equipmentMatch: boolean;
    movementMatch: boolean;
    executionAcceptable: boolean;
    fullMovementVisible: boolean;
    licenseVerified: boolean;
    referencesVerified: boolean;
  };
};

const args = parseArgs();
const apply = Boolean(args.apply);
const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const host = configuredUrl ? new URL(configuredUrl).hostname : "";
const localHost =
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "host.docker.internal" ||
  /^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(host);
if (apply && !localHost && !args.allowProduction)
  throw new Error(
    "Refusing to apply to a non-local Supabase target without --allow-production",
  );

const result = JSON.parse(
  await readFile("data/media/media-validation-v15.json", "utf8"),
) as { version: string; candidates: ValidationCandidate[] };
if (result.version !== "1.5" || result.candidates.length !== 40)
  throw new Error("Expected a complete v1.5 result with 40 candidates");

const client = getAdminClient(false);
if (!client) throw new Error("Supabase is not configured");
const { data: rows, error } = await client
  .from("exercise_media")
  .select("id,source_url,status,exercises!inner(slug)");
if (error) throw error;
const { data: priorEvents, error: priorEventsError } = await client
  .from("media_review_events")
  .select("media_id,metadata")
  .contains("metadata", { validation_version: "1.5" });
if (priorEventsError) throw priorEventsError;
const reviewedMediaIds = new Set(
  (priorEvents ?? []).map((event) => String(event.media_id)),
);
const byIdentity = new Map(
  (rows ?? []).map((row) => {
    const relation = row.exercises as unknown as
      | { slug: string }
      | { slug: string }[];
    const slug = Array.isArray(relation) ? relation[0]?.slug : relation?.slug;
    return [`${slug}\0${row.source_url}`, row];
  }),
);

const primaryChecklist = (candidate: ValidationCandidate) => ({
  correct_exercise: candidate.reviewChecklist.exerciseIdentity,
  compatible_equipment: candidate.reviewChecklist.equipmentMatch,
  start_position_visible: candidate.reviewChecklist.fullMovementVisible,
  main_range_visible: candidate.reviewChecklist.fullMovementVisible,
  complete_repetition_visible: candidate.reviewChecklist.fullMovementVisible,
  technically_acceptable: candidate.reviewChecklist.executionAcceptable,
  sufficient_clarity: candidate.validationScore >= 85,
  useful_framing: candidate.validationScore >= 85,
  no_blocking_elements: candidate.validationScore >= 85,
  license_confirmed: candidate.reviewChecklist.licenseVerified,
  references_verified: candidate.reviewChecklist.referencesVerified,
  validation_version: "1.5",
  validation_score: candidate.validationScore,
  exercise_match: candidate.exerciseMatch,
});

let changed = 0;
let unchanged = 0;
for (const candidate of result.candidates) {
  const row = byIdentity.get(`${candidate.exerciseSlug}\0${candidate.sourceUrl}`);
  if (!row)
    throw new Error(
      `Database candidate missing: ${candidate.exerciseSlug}/${candidate.candidateId}`,
    );
  const targetStatus =
    candidate.decision === "REJECT"
      ? "rejected"
      : candidate.decision === "APPROVE"
        ? "reviewing"
        : "pending";
  if (!apply) {
    process.stdout.write(
      `[DRY-RUN] ${candidate.exerciseSlug}/${candidate.candidateId}: ${row.status} -> ${targetStatus}\n`,
    );
    continue;
  }
  if (row.status === targetStatus && reviewedMediaIds.has(String(row.id))) {
    unchanged++;
    continue;
  }
  const rejectionReason =
    candidate.decision !== "REJECT"
      ? null
      : !candidate.reviewChecklist.exerciseIdentity
        ? "wrong_exercise"
        : !candidate.reviewChecklist.equipmentMatch
          ? "wrong_equipment"
          : !candidate.reviewChecklist.fullMovementVisible
            ? "incomplete_movement"
            : !candidate.reviewChecklist.licenseVerified
              ? "license_issue"
              : "other";
  const update = {
    status: targetStatus,
    media_role:
      candidate.decision === "APPROVE" ? candidate.recommendedRole : null,
    execution_quality: candidate.executionQuality,
    review_checklist: primaryChecklist(candidate),
    review_notes: `[v1.5 ${candidate.decision}] ${candidate.reasoningSummary}`,
    rejection_reason: rejectionReason,
    reviewed_at: new Date().toISOString(),
    ready_for_processing: candidate.decision === "APPROVE",
    trim_start: candidate.trimStart ?? 0,
    trim_end: candidate.trimEnd,
  };
  if (row.status !== targetStatus || !reviewedMediaIds.has(String(row.id))) {
    const { error: updateError } = await client
      .from("exercise_media")
      .update(update)
      .eq("id", row.id);
    if (updateError) throw updateError;
  }
  const action =
    candidate.decision === "REJECT"
      ? "rejected"
      : candidate.decision === "APPROVE"
        ? candidate.recommendedRole === "PRIMARY_DEMO"
          ? "classified_primary"
          : candidate.recommendedRole === "EDUCATIONAL"
            ? "classified_educational"
            : "classified_variation"
        : "review_started";
  if (!reviewedMediaIds.has(String(row.id))) {
    const { error: eventError } = await client
      .from("media_review_events")
      .insert({
        media_id: row.id,
        action,
        from_status: row.status,
        to_status: targetStatus,
        notes: `VM Training media validation v1.5: ${candidate.decision}`,
        metadata: {
          candidate_id: candidate.candidateId,
          validation_version: "1.5",
          validation_score: candidate.validationScore,
          exercise_match: candidate.exerciseMatch,
        },
      });
    if (eventError) throw eventError;
  }
  changed++;
}

const mode = apply ? "APPLY" : "DRY-RUN";
process.stdout.write(
  `${mode}: candidates=${result.candidates.length} changed=${changed} unchanged=${unchanged} target=${localHost ? "local" : "non-local"}\n`,
);
if (apply) {
  const { data: verifiedRows, error: verificationError } = await client
    .from("exercise_media")
    .select("status,ready_for_processing");
  if (verificationError) throw verificationError;
  const { count: auditCount, error: auditError } = await client
    .from("media_review_events")
    .select("id", { count: "exact", head: true })
    .contains("metadata", { validation_version: "1.5" });
  if (auditError) throw auditError;
  const verification = {
    total: verifiedRows?.length ?? 0,
    reviewing: (verifiedRows ?? []).filter((row) => row.status === "reviewing")
      .length,
    rejected: (verifiedRows ?? []).filter((row) => row.status === "rejected")
      .length,
    pending: (verifiedRows ?? []).filter((row) => row.status === "pending")
      .length,
    approved: (verifiedRows ?? []).filter((row) => row.status === "approved")
      .length,
    readyForProcessing: (verifiedRows ?? []).filter(
      (row) => row.ready_for_processing,
    ).length,
    v15AuditEvents: auditCount ?? 0,
  };
  process.stdout.write(`VERIFIED: ${JSON.stringify(verification)}\n`);
  if (
    verification.total !== 40 ||
    verification.reviewing !== 7 ||
    verification.rejected !== 31 ||
    verification.pending !== 2 ||
    verification.approved !== 0 ||
    verification.readyForProcessing !== 7 ||
    verification.v15AuditEvents !== 40
  )
    throw new Error("Applied v1.5 state failed verification");
}
