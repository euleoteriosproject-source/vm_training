import { describe, expect, it } from "vitest";
import { generatePlan } from "./generator";
import type { ExerciseCandidate, PlanInput } from "./types";
const catalog: ExerciseCandidate[] = [
  {
    id: "squat",
    name: "Agachamento",
    pattern: "squat",
    category: "strength",
    equipment: ["bodyweight"],
    difficulty: "beginner",
    active: true,
    hasApprovedMedia: true,
  },
  {
    id: "row",
    name: "Remada",
    pattern: "horizontal_pull",
    category: "strength",
    equipment: ["bodyweight"],
    difficulty: "beginner",
    active: true,
    hasApprovedMedia: true,
  },
  {
    id: "push",
    name: "Supino",
    pattern: "horizontal_push",
    category: "strength",
    equipment: ["bodyweight"],
    difficulty: "beginner",
    active: true,
    hasApprovedMedia: true,
  },
  {
    id: "hinge",
    name: "Levantamento",
    pattern: "hinge",
    category: "strength",
    equipment: ["bodyweight"],
    difficulty: "beginner",
    active: true,
    hasApprovedMedia: true,
  },
  {
    id: "cardio",
    name: "Caminhada",
    pattern: "cardio",
    category: "cardio",
    equipment: ["bodyweight"],
    difficulty: "beginner",
    active: true,
    hasApprovedMedia: true,
  },
];
const input: PlanInput = {
  goals: [{ code: "general_health", priority: 1 }],
  sessionsPerWeek: 3,
  sessionMinutes: 60,
  cardioPreference: 3,
  experience: "beginner",
  equipment: [],
};
describe("generatePlan", () => {
  it("uses the requested weekly split", () => {
    expect(generatePlan(input, catalog)).toHaveLength(3);
  });
  it("never uses inactive exercises", () => {
    const result = generatePlan(input, [
      ...catalog,
      { ...catalog[0], id: "unsafe", active: false, hasApprovedMedia: false },
    ]);
    expect(
      result.flatMap((day) => day.exercises).map((ex) => ex.exerciseId),
    ).not.toContain("unsafe");
  });
  it("blocks generation when approved media coverage is insufficient", () => {
    const mediaPending = catalog.map((exercise) => ({
      ...exercise,
      hasApprovedMedia: false,
    }));
    expect(() => generatePlan(input, mediaPending)).toThrow(/demonstrações/);
  });
  it("only returns exercises with approved media", () => {
    const result = generatePlan(input, [
      ...catalog,
      { ...catalog[0], id: "pending", hasApprovedMedia: false },
    ]);
    expect(
      result.flatMap((day) => day.exercises).map((item) => item.exerciseId),
    ).not.toContain("pending");
  });
  it("keeps resistance work when cardio is high", () => {
    const result = generatePlan(
      {
        ...input,
        cardioPreference: 5,
        goals: [{ code: "conditioning", priority: 1 }],
      },
      catalog,
    );
    expect(
      result.every((day) =>
        day.exercises.some((ex) => ex.exerciseId !== "cardio"),
      ),
    ).toBe(true);
  });
  it("rejects an insufficient catalog", () =>
    expect(() => generatePlan(input, catalog.slice(0, 3))).toThrow(
      /insuficiente/,
    ));
  it("never lets a draft option bypass catalog eligibility", () => {
    const unavailable = catalog.map((exercise) => ({
      ...exercise,
      active: false,
      hasApprovedMedia: false,
    }));
    expect(() => generatePlan(input, unavailable)).toThrow(/insuficiente/);
  });
});
