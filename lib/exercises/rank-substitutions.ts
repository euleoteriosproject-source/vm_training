export type SubstitutionCandidate = {
  id: string;
  baseScore: number;
  sameMovementPattern: boolean;
  samePrimaryMuscle: boolean;
  requiredEquipment: string[];
  difficulty: number;
  preference?: "like" | "neutral" | "dislike" | "avoid";
  hasApprovedPrimaryMedia: boolean;
};

export function rankSubstitutions(
  candidates: SubstitutionCandidate[],
  availableEquipment: string[],
  targetDifficulty: number,
) {
  const available = new Set(availableEquipment);
  return candidates
    .filter(
      (candidate) =>
        candidate.preference !== "avoid" &&
        candidate.hasApprovedPrimaryMedia &&
        candidate.requiredEquipment.every((item) => available.has(item)),
    )
    .map((candidate) => ({
      ...candidate,
      rank:
        candidate.baseScore +
        (candidate.sameMovementPattern ? 30 : 0) +
        (candidate.samePrimaryMuscle ? 20 : 0) +
        (candidate.preference === "like"
          ? 10
          : candidate.preference === "dislike"
            ? -10
            : 0) -
        Math.abs(candidate.difficulty - targetDifficulty) * 4,
    }))
    .sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
}
