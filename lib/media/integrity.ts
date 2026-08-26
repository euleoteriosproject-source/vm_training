export type PrimaryMediaRecord = {
  id: string;
  exerciseId: string;
  mediaType: string;
  storagePath: string | null;
  posterPath: string | null;
  contentHash: string | null;
  actualHash?: string | null;
  animationVerified: boolean;
  frameCount: number | null;
  durationSeconds: number | null;
  animationLoop: boolean | null;
};

export type MediaIntegrityCode =
  | "DB_WITHOUT_FILE"
  | "FILE_WITHOUT_DB"
  | "HASH_MISMATCH"
  | "APPROVED_WITHOUT_ANIMATION"
  | "APPROVED_WITHOUT_POSTER"
  | "GIF_SINGLE_FRAME"
  | "PRIMARY_STATIC_IMAGE"
  | "DUPLICATE_PRIMARY";

export function reconcileMediaIntegrity(
  records: PrimaryMediaRecord[],
  storagePaths: Iterable<string>,
  allReferencedPaths?: Iterable<string>,
) {
  const files = new Set(storagePaths);
  const referenced = new Set(
    allReferencedPaths ??
      records.flatMap(
        (row) => [row.storagePath, row.posterPath].filter(Boolean) as string[],
      ),
  );
  const issues: Array<{
    code: MediaIntegrityCode;
    id?: string;
    path?: string;
  }> = [];
  const byExercise = new Map<string, number>();
  for (const row of records) {
    byExercise.set(row.exerciseId, (byExercise.get(row.exerciseId) ?? 0) + 1);
    if (!row.storagePath || !files.has(row.storagePath))
      issues.push({
        code: "DB_WITHOUT_FILE",
        id: row.id,
        path: row.storagePath ?? undefined,
      });
    if (!row.posterPath || !files.has(row.posterPath))
      issues.push({
        code: "APPROVED_WITHOUT_POSTER",
        id: row.id,
        path: row.posterPath ?? undefined,
      });
    if (row.actualHash && row.contentHash !== row.actualHash)
      issues.push({
        code: "HASH_MISMATCH",
        id: row.id,
        path: row.storagePath ?? undefined,
      });
    if (row.mediaType === "image")
      issues.push({ code: "PRIMARY_STATIC_IMAGE", id: row.id });
    if (
      !row.animationVerified ||
      !(row.durationSeconds && row.durationSeconds > 0)
    )
      issues.push({ code: "APPROVED_WITHOUT_ANIMATION", id: row.id });
    if (row.mediaType === "gif" && (row.frameCount ?? 0) <= 1)
      issues.push({ code: "GIF_SINGLE_FRAME", id: row.id });
  }
  for (const [exerciseId, count] of byExercise)
    if (count > 1) issues.push({ code: "DUPLICATE_PRIMARY", id: exerciseId });
  for (const file of files)
    if (!referenced.has(file))
      issues.push({ code: "FILE_WITHOUT_DB", path: file });
  return issues;
}
