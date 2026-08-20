import { describe, expect, it } from "vitest";
import {
  progressChange,
  transformHistory,
  weeklyFrequency,
} from "./calculations";
describe("progress calculations", () => {
  it("counts sessions from Monday", () => {
    const now = new Date("2026-08-19T12:00:00Z");
    expect(
      weeklyFrequency(
        [
          { completedAt: "2026-08-17T12:00:00Z" },
          { completedAt: "2026-08-16T12:00:00Z" },
        ],
        now,
      ),
    ).toBe(1);
  });
  it("calculates percentage change", () =>
    expect(progressChange([100, 90])).toBe(-10));
  it("transforms completed volume", () =>
    expect(
      transformHistory([
        {
          completed_at: "2026-08-19",
          duration_seconds: 600,
          set_logs: [
            { completed: true, weight_kg: 10, reps: 10 },
            { completed: false, weight_kg: 20, reps: 10 },
          ],
        },
      ])[0],
    ).toMatchObject({ completedSets: 1, totalVolumeKg: 100 }));
});
