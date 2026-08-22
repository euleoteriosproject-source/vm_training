import { describe, expect, it } from "vitest";
import {
  maskBrazilianDate,
  parseBrazilianDate,
  toBrazilianDate,
} from "./dates";

describe("Brazilian dates", () => {
  it("stores a valid DD/MM/YYYY value as ISO", () => {
    expect(parseBrazilianDate("21/08/1990")).toBe("1990-08-21");
  });

  it("rejects impossible calendar dates", () => {
    expect(parseBrazilianDate("31/02/2000")).toBeNull();
  });

  it("masks mobile numeric input and restores a stored ISO date", () => {
    expect(maskBrazilianDate("21081990")).toBe("21/08/1990");
    expect(toBrazilianDate("1990-08-21")).toBe("21/08/1990");
  });
});
