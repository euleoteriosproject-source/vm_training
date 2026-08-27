import { describe, expect, it } from "vitest";
import { sessionSwapRequestSchema } from "./session-swap";

describe("session swap contract", () => {
  it("accepts a selected direct or goal-aligned session replacement", () => {
    expect(
      sessionSwapRequestSchema.safeParse({
        action: "replace",
        replacementExerciseId: "11111111-1111-4111-8111-111111111111",
        replacementType: "GOAL_ALIGNED_ALTERNATIVE",
        reasonCode: "occupied_today",
      }).success,
    ).toBe(true);
  });

  it("rejects weekly rebalance in session-only scope", () => {
    expect(
      sessionSwapRequestSchema.safeParse({
        action: "replace",
        replacementExerciseId: "11111111-1111-4111-8111-111111111111",
        replacementType: "REQUIRES_REBALANCE",
        reasonCode: "user_choice",
      }).success,
    ).toBe(false);
  });

  it("accepts only an event id for undo", () => {
    expect(
      sessionSwapRequestSchema.safeParse({
        action: "undo",
        eventId: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(true);
  });
});
