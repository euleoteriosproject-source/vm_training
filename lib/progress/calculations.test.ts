import { describe, expect, it } from "vitest";
import {
  ageInYears,
  adultBmiCategory,
  bodyMassIndex,
  progressChange,
  transformHistory,
  weeklyFrequency,
  weightChange,
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
  it("classifies BMI only for adults using the published screening bands", () => {
    expect(adultBmiCategory(18.49, 20)).toBe("Abaixo do peso");
    expect(adultBmiCategory(18.5, 20)).toBe("Faixa saudável");
    expect(adultBmiCategory(25, 30)).toBe("Sobrepeso");
    expect(adultBmiCategory(31, 30)).toBe("Obesidade classe 1");
    expect(adultBmiCategory(37, 30)).toBe("Obesidade classe 2");
    expect(adultBmiCategory(40, 30)).toBe("Obesidade classe 3");
  });
  it("does not apply adult BMI categories to people under 20", () => {
    expect(adultBmiCategory(24, 19)).toBeNull();
    expect(adultBmiCategory(24, null)).toBeNull();
  });
  it("calculates actual change inside a requested time window", () => {
    const rows = [
      { weight: 82, measuredAt: "2026-06-01T12:00:00Z" },
      { weight: 81, measuredAt: "2026-08-01T12:00:00Z" },
      { weight: 80.4, measuredAt: "2026-08-20T12:00:00Z" },
    ];
    expect(
      weightChange(rows, 30, new Date("2026-08-22T12:00:00Z")),
    ).toBeCloseTo(-0.6);
    expect(weightChange(rows, 7, new Date("2026-08-22T12:00:00Z"))).toBeNull();
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
