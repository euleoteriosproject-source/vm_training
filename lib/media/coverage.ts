export type CoverageRow = {
  exerciseId: string;
  name: string;
  active: boolean;
  mediaStatuses: string[];
};
export function calculateCoverage(rows: CoverageRow[]) {
  const total = rows.length;
  const approved = rows.filter((row) =>
    row.mediaStatuses.includes("approved"),
  ).length;
  const pending = rows.filter(
    (row) =>
      !row.mediaStatuses.includes("approved") &&
      row.mediaStatuses.some(
        (status) => status === "pending" || status === "reviewing",
      ),
  ).length;
  const reviewing = rows.filter(
    (row) =>
      !row.mediaStatuses.includes("approved") &&
      row.mediaStatuses.includes("reviewing"),
  ).length;
  const pendingOnly = rows.filter(
    (row) =>
      !row.mediaStatuses.includes("approved") &&
      !row.mediaStatuses.includes("reviewing") &&
      row.mediaStatuses.includes("pending"),
  ).length;
  const rejected = rows.filter(
    (row) =>
      !row.mediaStatuses.includes("approved") &&
      row.mediaStatuses.includes("rejected"),
  ).length;
  const missing = total - approved - pending - rejected;
  const activeMissing = rows.filter(
    (row) => row.active && !row.mediaStatuses.includes("approved"),
  );
  return {
    total,
    approved,
    pending,
    pendingOnly,
    reviewing,
    rejected,
    missing,
    activeMissing,
    coverage: total === 0 ? 100 : Number(((approved / total) * 100).toFixed(1)),
    candidateCoverage:
      total === 0
        ? 100
        : Number((((approved + pending) / total) * 100).toFixed(1)),
  };
}
