export const mediaRoles = [
  "PRIMARY_DEMO",
  "EDUCATIONAL",
  "ALTERNATIVE_VARIATION",
] as const;

export type MediaRole = (typeof mediaRoles)[number];

export const mediaStatuses = [
  "pending",
  "reviewing",
  "processing",
  "processed",
  "approved",
  "rejected",
  "failed",
] as const;

export type MediaStatus = (typeof mediaStatuses)[number];

export const primaryChecklistKeys = [
  "correct_exercise",
  "compatible_equipment",
  "start_position_visible",
  "main_range_visible",
  "complete_repetition_visible",
  "technically_acceptable",
  "sufficient_clarity",
  "useful_framing",
  "no_blocking_elements",
  "license_confirmed",
] as const;

export type PrimaryChecklistKey = (typeof primaryChecklistKeys)[number];
export type PrimaryChecklist = Partial<Record<PrimaryChecklistKey, boolean>>;

export const gifFallbackReasons = [
  "GIF_SIZE_TOO_LARGE",
  "GIF_QUALITY_INSUFFICIENT",
  "GIF_MOTION_DEGRADED",
  "GIF_PROCESSING_FAILED",
] as const;
export type GifFallbackReason = (typeof gifFallbackReasons)[number];

const transitions: Record<MediaStatus, readonly MediaStatus[]> = {
  pending: ["reviewing", "rejected"],
  reviewing: ["processing", "rejected"],
  processing: ["processed", "failed"],
  processed: ["approved", "rejected", "processing"],
  approved: ["rejected", "reviewing"],
  rejected: ["reviewing"],
  failed: ["processing", "rejected"],
};

export function canTransitionMedia(
  from: MediaStatus,
  to: MediaStatus,
): boolean {
  return transitions[from].includes(to);
}

export function isPrimaryChecklistComplete(
  checklist: PrimaryChecklist | null | undefined,
): boolean {
  return primaryChecklistKeys.every((key) => checklist?.[key] === true);
}

export function validateMediaClassification(input: {
  role: MediaRole;
  executionQuality: "approved" | "acceptable" | "rejected";
  checklist?: PrimaryChecklist;
}) {
  const errors: string[] = [];
  if (
    input.role === "PRIMARY_DEMO" &&
    !isPrimaryChecklistComplete(input.checklist)
  )
    errors.push("review_checklist");
  if (input.role === "PRIMARY_DEMO" && input.executionQuality !== "approved")
    errors.push("execution_quality");
  return { valid: errors.length === 0, errors };
}

export type ExerciseReadinessInput = {
  active: boolean;
  approvedPrimaryMedia: boolean;
  instructions: string[] | null;
  equipmentCount: number;
  movementPattern: string | null;
  primaryMuscles: string[] | null;
};

export function getExercisePublishReadiness(input: ExerciseReadinessInput) {
  const result = {
    hasApprovedPrimaryMedia: input.approvedPrimaryMedia,
    hasInstructions: Boolean(input.instructions?.length),
    hasEquipment: input.equipmentCount > 0,
    hasMovementPattern: Boolean(input.movementPattern?.trim()),
    hasPrimaryMuscles: Boolean(input.primaryMuscles?.length),
    active: input.active,
  };
  return {
    ...result,
    ready:
      result.hasApprovedPrimaryMedia &&
      result.hasInstructions &&
      result.hasEquipment &&
      result.hasMovementPattern &&
      result.hasPrimaryMuscles,
  };
}

export function mediaStoragePaths(input: {
  exerciseSlug: string;
  role: MediaRole;
  hash: string;
  mediaType?: "gif" | "video";
}) {
  const slug = input.exerciseSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const hash = input.hash.toLowerCase().replace(/[^a-f0-9]/g, "");
  if (!slug || hash.length < 12) throw new Error("Storage identity inválida");
  const folder =
    input.role === "PRIMARY_DEMO"
      ? "primary"
      : input.role === "EDUCATIONAL"
        ? "educational"
        : "variations";
  const base = `exercises/${slug}/${folder}/${hash}`;
  const mediaType = input.mediaType ?? "video";
  const mediaPath = `${base}.${mediaType === "gif" ? "gif" : "mp4"}`;
  return {
    mediaPath,
    videoPath: `${base}.mp4`,
    gifPath: `${base}.gif`,
    posterPath: `${base}.webp`,
  };
}

export function validateAnimatedPrimary(input: {
  mediaType: string;
  animationVerified: boolean;
  frameCount: number | null;
  durationSeconds: number | null;
  animationLoop: boolean | null;
  fallbackReason: string | null;
}) {
  if (input.mediaType === "image") return false;
  if (
    !input.animationVerified ||
    !(input.durationSeconds && input.durationSeconds > 0)
  )
    return false;
  if (input.mediaType === "gif")
    return (
      (input.frameCount ?? 0) > 1 &&
      input.animationLoop === true &&
      input.fallbackReason === null
    );
  return (
    input.mediaType === "video" &&
    gifFallbackReasons.includes(input.fallbackReason as GifFallbackReason)
  );
}

export function calculatePlanCoverage(
  exerciseIds: string[],
  approvedPrimaryExerciseIds: Iterable<string>,
) {
  const unique = [...new Set(exerciseIds)];
  const approved = new Set(approvedPrimaryExerciseIds);
  const covered = unique.filter((id) => approved.has(id));
  const missing = unique.filter((id) => !approved.has(id));
  return {
    exercises: unique.length,
    primaryApproved: covered.length,
    missing,
    percentage:
      unique.length === 0
        ? 100
        : Number(((covered.length / unique.length) * 100).toFixed(1)),
  };
}
