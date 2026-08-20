import { describe, expect, it } from "vitest";
import { rankSubstitutions } from "./rank-substitutions";
describe("rankSubstitutions", () => {
  it("prioritizes compatible movement and muscle", () => {
    const result = rankSubstitutions(
      [
        {
          id: "best",
          baseScore: 50,
          sameMovementPattern: true,
          samePrimaryMuscle: true,
          requiredEquipment: ["cable"],
          difficulty: 1,
          hasApprovedPrimaryMedia: true,
        },
        {
          id: "other",
          baseScore: 60,
          sameMovementPattern: false,
          samePrimaryMuscle: false,
          requiredEquipment: ["cable"],
          difficulty: 1,
          hasApprovedPrimaryMedia: true,
        },
      ],
      ["cable"],
      1,
    );
    expect(result[0].id).toBe("best");
  });
  it("removes unavailable and avoided choices", () => {
    const result = rankSubstitutions(
      [
        {
          id: "avoid",
          baseScore: 100,
          sameMovementPattern: true,
          samePrimaryMuscle: true,
          requiredEquipment: ["cable"],
          difficulty: 1,
          preference: "avoid",
          hasApprovedPrimaryMedia: true,
        },
        {
          id: "missing",
          baseScore: 100,
          sameMovementPattern: true,
          samePrimaryMuscle: true,
          requiredEquipment: ["smith"],
          difficulty: 1,
          hasApprovedPrimaryMedia: true,
        },
      ],
      ["cable"],
      1,
    );
    expect(result).toHaveLength(0);
  });
});
