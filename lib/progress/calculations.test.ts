import { describe, expect, it } from "vitest";
import {
  ageInYears,
  bodyMassIndex,
  progressChange,
  transformHistory,
  weeklyFrequency,
  weightTrend,
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
  it("calculates BMI without turning it into a diagnosis", () =>
    expect(bodyMassIndex(80, 180)).toBeCloseTo(24.69, 2));
  it("calculates age around the birthday boundary", () => {
    expect(ageInYears("2000-08-22", new Date("2026-08-21T12:00:00Z"))).toBe(25);
    expect(ageInYears("2000-08-21", new Date("2026-08-21T12:00:00Z"))).toBe(26);
  });
  it("describes weight trend from actual measurements", () => {
    expect(weightTrend(79.4, 80)).toBe("-0,6 kg");
    expect(weightTrend(80, null)).toBe("Primeiro registro");
  });
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
