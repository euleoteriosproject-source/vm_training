import { describe, expect, it } from "vitest";
import { scoreMediaMatch } from "./matching";
const exercise = {
  id: "1",
  slug: "seated-row",
  namePt: "Remada baixa",
  nameEn: "Seated cable row",
  aliases: ["Cable row", "Low row"],
  movementPattern: "horizontal_pull",
  equipment: ["cable"],
  muscles: ["back"],
};
describe("media matching", () => {
  it("requires exact semantics plus context", () => {
    const result = scoreMediaMatch(exercise, {
      title: "Seated cable row.webm",
      description: "Cable exercise for the back",
      categories: ["Rowing exercises"],
    });
    expect(result.eligible).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });
  it("does not suggest ambiguous Row by name alone", () => {
    const result = scoreMediaMatch(exercise, {
      title: "Row.webm",
      description: "Exercise",
      categories: [],
    });
    expect(result.eligible).toBe(false);
  });
  it("penalizes free weights for a machine chest press", () => {
    const machine = {
      ...exercise,
      slug: "machine-chest-press",
      namePt: "Supino máquina",
      nameEn: "Machine chest press",
      aliases: ["Seated chest press"],
      movementPattern: "horizontal_push",
      equipment: ["machine", "chest press"],
      muscles: ["chest"],
    };
    const exact = scoreMediaMatch(machine, {
      title: "Machine chest press exercise.webm",
      description: "Seated machine exercise for chest",
      categories: ["Strength training exercises"],
    });
    const barbell = scoreMediaMatch(machine, {
      title: "Barbell bench press.webm",
      description: "Free-weight chest exercise with an Olympic bar",
      categories: ["Strength training exercises"],
    });
    expect(exact.score).toBeGreaterThan(barbell.score);
    expect(barbell.negativeReasons).toContain("wrong equipment");
  });
});
