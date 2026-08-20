import { isPrimaryChecklistComplete } from "./operations";

export type ApprovalInput = {
  status: string;
  storagePath: string | null;
  posterPath: string | null;
  contentHash: string | null;
  licenseCode: string | null;
  verifiedBy: string | null;
  executionQuality: string;
  attributionRequired: boolean;
  author: string | null;
  attributionText: string | null;
  licenseUrl: string | null;
  mediaRole: string | null;
  checklist?: Record<string, boolean> | null;
  processedAt?: string | null;
};
export function validateApproval(input: ApprovalInput) {
  const errors: string[] = [];
  if (input.status !== "processed") errors.push("candidate_status");
  if (!input.storagePath) errors.push("storage_path");
  if (!input.posterPath) errors.push("poster_path");
  if (!input.contentHash) errors.push("content_hash");
  if (!input.licenseCode) errors.push("license_code");
  if (!input.author || !input.attributionText)
    errors.push("attribution_metadata");
  if (!input.verifiedBy) errors.push("verified_by");
  if (input.executionQuality !== "approved") errors.push("execution_quality");
  if (!input.processedAt) errors.push("processed_at");
  if (!input.mediaRole) errors.push("media_role");
  if (
    input.mediaRole === "PRIMARY_DEMO" &&
    !isPrimaryChecklistComplete(input.checklist)
  )
    errors.push("review_checklist");
  if (input.attributionRequired && !input.licenseUrl)
    errors.push("attribution");
  return { valid: errors.length === 0, errors };
}
