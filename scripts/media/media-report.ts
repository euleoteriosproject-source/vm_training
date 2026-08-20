import { readFile } from "node:fs/promises";
import {
  calculateCoverage,
  type CoverageRow,
} from "../../lib/media/coverage.ts";
import { fallbackCatalog, seededPendingCandidateSlugs } from "./catalog.ts";
import { getAdminClient, log } from "./shared.ts";

type Candidate = {
  title?: string;
  source?: string;
  licenseCode?: string;
  score?: number;
  confidence?: string;
};
type Detail = CoverageRow & {
  slug: string;
  best?: Candidate;
  executionReview: string;
  candidateCount: number;
  missingReason?: string | null;
};
const client = getAdminClient(false);
let rows: Detail[];
if (client) {
  const { data, error } = await client
    .from("exercises")
    .select(
      "id,slug,name_pt,active,exercise_media(status,source_name,license_code,match_score,execution_quality,candidate_metadata)",
    )
    .order("name_pt");
  if (error) throw error;
  rows = (data ?? []).map((item) => {
    const media = (item.exercise_media ?? []) as Array<{
      status: string;
      source_name: string | null;
      license_code: string | null;
      match_score: number | null;
      execution_quality: string;
      candidate_metadata: { title?: string; confidence?: string } | null;
    }>;
    const best = [...media].sort(
      (a, b) => (b.match_score ?? 0) - (a.match_score ?? 0),
    )[0];
    return {
      exerciseId: item.id,
      slug: item.slug,
      name: item.name_pt,
      active: item.active,
      mediaStatuses: media.map((entry) => entry.status),
      candidateCount: media.filter((entry) =>
        ["pending", "reviewing", "approved"].includes(entry.status),
      ).length,
      executionReview: best?.execution_quality ?? "pending",
      best: best
        ? {
            title: best.candidate_metadata?.title,
            source: best.source_name ?? undefined,
            licenseCode: best.license_code ?? undefined,
            score: best.match_score ?? undefined,
            confidence: best.candidate_metadata?.confidence,
          }
        : undefined,
    };
  });
} else {
  const artifact = await readFile(".tmp/media-candidates.json", "utf8")
    .then(
      (value) =>
        JSON.parse(value) as {
          exercises?: Array<{
            slug: string;
            missingReason?: string | null;
            candidates?: Candidate[];
          }>;
        },
    )
    .catch(() => ({ exercises: [] }));
  const discovered = new Map(
    (artifact.exercises ?? []).map((item) => [item.slug, item]),
  );
  rows = fallbackCatalog.map((item) => {
    const local = discovered.get(item.slug),
      candidates = local?.candidates ?? [];
    const hasCandidate =
      candidates.length > 0 || seededPendingCandidateSlugs.has(item.slug);
    return {
      exerciseId: item.slug,
      slug: item.slug,
      name: item.namePt,
      active: false,
      mediaStatuses: hasCandidate ? ["pending"] : [],
      candidateCount: Math.max(
        candidates.length,
        seededPendingCandidateSlugs.has(item.slug) ? 1 : 0,
      ),
      executionReview: "pending",
      missingReason: hasCandidate
        ? null
        : (local?.missingReason ?? "not_searched"),
      best:
        candidates[0] ??
        (seededPendingCandidateSlugs.has(item.slug)
          ? {
              title: "Known CDC candidate",
              source: "CDC / Wikimedia Commons",
              licenseCode: "PD",
            }
          : undefined),
    };
  });
  log(
    "REPORT",
    "Supabase não configurado; usando seed e artefato local de discovery.",
  );
}
const result = calculateCoverage(rows);
const status = (row: Detail) =>
  row.mediaStatuses.includes("approved")
    ? "approved"
    : row.mediaStatuses.includes("reviewing")
      ? "reviewing"
      : row.mediaStatuses.includes("pending")
        ? "pending"
        : row.mediaStatuses.includes("rejected")
          ? "rejected"
          : "missing";
process.stdout.write(
  `\nVM Training Exercise Media Coverage\n\nTotal exercises:        ${result.total}\n\nApproved:               ${result.approved}\nPending:                ${result.pendingOnly}\nReviewing:              ${result.reviewing}\nRejected:               ${result.rejected}\nMissing:                ${result.missing}\n\nApproved coverage:      ${result.coverage.toFixed(1)}%\nCandidate coverage:     ${result.candidateCoverage.toFixed(1)}%\n\nExercise | Internal slug | Status | Source | License | Match score | Execution review | Candidate count | Missing reason\n--- | --- | --- | --- | --- | ---: | --- | ---: | ---\n${rows.map((row) => `${row.name} | ${row.slug} | ${status(row)} | ${row.best?.source ?? "—"} | ${row.best?.licenseCode ?? "—"} | ${row.best?.score ?? "—"} | ${row.executionReview} | ${row.candidateCount} | ${row.missingReason ?? "—"}`).join("\n")}\n`,
);
