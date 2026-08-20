import { describe, expect, it } from "vitest";
import { buildExerciseSearchQueries } from "./search-queries";
import type { MatchExercise } from "./types";

const exercise = (
  slug: string,
  namePt: string,
  nameEn: string,
): MatchExercise => ({
  id: slug,
  slug,
  namePt,
  nameEn,
  aliases: [],
  movementPattern: "knee_extension",
  equipment: ["machine"],
  muscles: ["quadriceps"],
});

describe("exercise media query builder", () => {
  it("expands lat pulldown queries", () => {
    const queries = buildExerciseSearchQueries(
      exercise("lat-pulldown", "Puxada frontal", "Lat pulldown"),
    );
    expect(queries).toEqual(
      expect.arrayContaining([
        "lat pulldown",
        "front lat pulldown",
        "cable pulldown",
      ]),
    );
  });
  it("includes leg extension machine aliases", () => {
    const queries = buildExerciseSearchQueries(
      exercise("leg-extension", "Cadeira extensora", "Leg extension"),
    );
    expect(queries).toEqual(
      expect.arrayContaining([
        "leg extension",
        "seated leg extension",
        "leg extension machine",
      ]),
    );
  });
  it("includes face-pull variants and deduplicates normalized queries", () => {
    const item = exercise("face-pull", "Face pull", "Face pull");
    item.aliases = ["Face pulls", "face pull"];
    const queries = buildExerciseSearchQueries(item);
    expect(queries).toEqual(
      expect.arrayContaining([
        "face pull",
        "cable face pull",
        "rope face pull",
      ]),
    );
    expect(new Set(queries).size).toBe(queries.length);
  });
});
